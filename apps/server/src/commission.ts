import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { chartTitle, parseCsv, tr, type Lang, type LTextT } from "@codigo-alta/shared";
import { Engine, GameError } from "./engine.js";
import type { AiService } from "./ai/service.js";
import { fill } from "./ai/characters.js";
import { inputProblem, scrubOutput } from "./ai/moderation.js";

interface Persona { id: string; name: string; role: LTextT; focus: LTextT }
interface CommissionCfg {
  turns: number; personas: Persona[]; order: string[]; questions: Record<string, LTextT>; tips?: LTextT[];
  endings: Record<string, { title: LTextT; text: LTextT }>; badges: Record<string, { es: string; gl: string; why: LTextT }>;
}
export const loadCommission = (contentDir: string): CommissionCfg => YAML.parse(fs.readFileSync(path.join(contentDir, "commission.yaml"), "utf8"));

/** A summary card: what the team did and decided, in a few words, to answer the Commission (27-nov: shown, not attached). */
export interface EvidenceCard { id: string; icon?: string; title: string; text: string }
/** Figures of the clean final model (data/dist/canon/fct_admission_clean.csv), the same for every team. */
interface CanonStats { n: number; r: number; years: string; centers: { name: string; n: number; r: number }[]; ages: { band: string; n: number; r: number }[] }
export function loadCanonStats(file: string): CanonStats | undefined {
  if (!fs.existsSync(file)) return undefined;
  const [head, ...rows] = parseCsv(fs.readFileSync(file, "utf8"), ",");
  const ix = (c: string) => head.cells.indexOf(c);
  const iO = ix("organization_name"), iR = ix("is_readmission_30d"), iA = ix("age_band"), iY = ix("admit_year");
  const by = (i: number) => { const m = new Map<string, { n: number; r: number }>(); for (const row of rows) { if (row.cells.length < head.cells.length) continue; const k = row.cells[i], g = m.get(k) ?? { n: 0, r: 0 }; g.n++; if (row.cells[iR] === "true") g.r++; m.set(k, g); } return m; };
  const valid = rows.filter((x) => x.cells.length >= head.cells.length);
  const yrs = valid.map((x) => Number(x.cells[iY])).filter(Number.isFinite);
  return {
    n: valid.length, r: valid.filter((x) => x.cells[iR] === "true").length, years: `${Math.min(...yrs)}-${Math.max(...yrs)}`,
    centers: [...by(iO)].map(([name, g]) => ({ name, ...g })), ages: [...by(iA)].filter(([b]) => b !== "n/d").map(([band, g]) => ({ band, ...g })),
  };
}
const pct = (r: number, n: number, lang: Lang) => (n ? (100 * r / n).toLocaleString(lang === "gl" ? "gl" : "es", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : "–");
export interface CommissionView {
  total: number; turn: number; done: boolean;
  question?: { persona: { id: string; name: string; role: string }; text: string; tip?: string };
  evidence: EvidenceCard[];
  history: { persona: string; question: string; answer: string; evidence: string[]; hint?: string }[];
  result?: CommissionResult;
}
export interface CommissionResult {
  ending: "approved" | "conditions" | "more_data"; title: string; text: string;
  votes: { persona: string; vote: number }[]; report: string; badges: { id: string; name: string; why: string }[]; score: number;
}
const EvalSchema = z.object({
  scores: z.object({ clarity: z.number(), evidence: z.number(), honesty_about_limits: z.number(), actionability: z.number() }),
  factual_errors: z.array(z.string()).default([]), followup_hint: z.string().default(""), vote_signal: z.number(),
});
type Evaluation = z.infer<typeof EvalSchema>;
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Facts that are TRUE about the case (the evaluator checks the team's answer against them). */
const GROUND_TRUTH = {
  es: "Tasa de reingreso del modelo limpio: alrededor del 10 % (unos 10 de cada 100 altas). Centro con la tasa más alta (con un mínimo de altas): Illa Verde, ~18 %. La Clínica Illas Cíes tiene solo 3 altas. El hospital tiene 9 centros. Hay 9 003 personas distintas (9 015 fichas: hay duplicadas). Hay ingresos sin fecha de alta. El reingreso se define a 2-30 días naturales tras el alta, solo ingresos inpatient. Hay registros posteriores al fallecimiento por retraso en el registro de defunciones, y una migración duplicó marcas en el centro H3. Un centro con 3 ingresos tiene 100 % de tasa por azar y no es comparable.",
  gl: "Taxa de reingreso do modelo limpo: arredor do 10 % (uns 10 de cada 100 altas). Centro coa taxa máis alta (cun mínimo de altas): Illa Verde, ~18 %. A Clínica Illas Cíes ten só 3 altas. O hospital ten 9 centros. Hai 9 003 persoas distintas (9 015 fichas: hai duplicadas). Hai ingresos sen data de alta. O reingreso defínese a 2-30 días naturais tras a alta, só ingresos inpatient. Hai rexistros posteriores ao falecemento por atraso no rexistro de defuncións, e unha migración duplicou marcas no centro H3. Un centro con 3 ingresos ten 100 % de taxa por azar e non é comparable.",
};
const FALSE_CLAIMS: { re: RegExp; es: string }[] = [
  { re: /9\.?\s?015\s+(pacientes|personas)\s+(unic|distint)/, es: "Hay 9 015 pacientes únicos (en realidad hay 9 003 personas distintas)." },
  { re: /(ningun|no hay)\s+ingreso[s]?\s+(sin|con la fecha de alta vacia)/, es: "No hay ingresos sin fecha de alta (sí los hay)." },
  { re: /(centro pequeno|illas cies).{0,40}(el peor|mayor tasa real|peor hospital)/, es: "El centro pequeño es el peor (su tasa es azar de pocos casos)." },
];

export class Commission {
  private stats?: CanonStats;
  constructor(private e: Engine, private ai: AiService | undefined, private cfg: CommissionCfg, private prompts: Record<string, string>, canonCsv?: string) {
    this.stats = canonCsv ? loadCanonStats(canonCsv) : undefined;
  }

  private lockState(teamId: string) {
    const p = this.e.progress(teamId).f_comision;
    if (!p || p.status === "locked") throw new GameError(409, "not_yet", "La Comisión todavía no os espera");
    return p;
  }
  private persona(id: string) { return this.cfg.personas.find((p) => p.id === id)!; }
  /** The KPI minimum the team fixed is sensible: any value in the lock's range (content/locks/r5a_kpi.yaml). */
  private minOk(v: string | undefined) {
    const r = this.e.content.locks.get("r5a_kpi")?.numeric_ranges.find((x) => x.field === "min_n");
    const n = Number(v);
    return v === r?.canonical || (!!r && Number.isFinite(n) && n >= r.min && n <= r.max);
  }

  // ---------- summary cards: everything done and decided, very short, to answer from ----------
  evidence(teamId: string, lang: Lang): EvidenceCard[] {
    const prog = this.e.progress(teamId), led = this.e.ledger(teamId), gl = lang === "gl";
    const done = (id: string) => prog[id]?.status === "done";
    const val = (k: string) => this.e.answerValue(k);
    const num = (v: unknown) => (typeof v === "number" ? v.toLocaleString(gl ? "gl" : "es") : String(v ?? "?"));
    const out: EvidenceCard[] = [];
    const add = (id: string, icon: string, es: string, glT: string, textEs: string, textGl: string) => out.push({ id, icon, title: gl ? glT : es, text: gl ? textGl : textEs });
    const r1b = led.find((l) => l.lock_id === "r1b_reenvio")?.tag;
    if (done("r1a_bandeja")) add("ev_data", "📥", "Los datos", "Os datos",
      `8 ficheros de 4 hospitales, cada uno con su formato. ${r1b === "correct_dedupe" ? `Del fichero que un hospital mandó dos veces os quedasteis con la versión nueva: ${num(val("r1b_unique_encounters"))} visitas sin repetir.` : r1b ? "Con el fichero que un hospital mandó dos veces os quedaron visitas repetidas o perdisteis el rastro." : ""} Ada (la IA) dijo dos cosas falsas y las pillasteis con los datos.`,
      `8 ficheiros de 4 hospitais, cada un co seu formato. ${r1b === "correct_dedupe" ? `Do ficheiro que un hospital mandou dúas veces quedastes coa versión nova: ${num(val("r1b_unique_encounters"))} visitas sen repetir.` : r1b ? "Co ficheiro que un hospital mandou dúas veces quedáronvos visitas repetidas ou perdestes o rastro." : ""} Ada (a IA) dixo dúas cousas falsas e collíchedelas cos datos.`);
    if (done("r2a_radar")) {
      const bad = this.e.eventCount(teamId, "privacy_critical") > 0;
      add("ev_privacy", "🔐", "Privacidad", "Privacidade",
        `Nombre y dirección, fuera. El número de identificación, cambiado por un código. Fecha de nacimiento y código postal, en tramos.${bad ? " Hubo un momento en que un dato que identifica quedó a la vista; se corrigió." : ""}`,
        `Nome e enderezo, fóra. O número de identificación, cambiado por un código. Data de nacemento e código postal, en tramos.${bad ? " Houbo un momento no que un dato que identifica quedou á vista; corrixiuse." : ""}`);
    }
    if (done("r3c_modelo")) add("ev_def", "📏", "Qué es un reingreso", "Que é un reingreso",
      "Volver a ingresar entre 2 y 30 días después del alta, según el protocolo oficial. Solo cuentan los ingresos (no urgencias ni consultas).",
      "Volver ingresar entre 2 e 30 días despois da alta, segundo o protocolo oficial. Só contan os ingresos (non urxencias nin consultas).");
    if (done("r4c_veredicto")) add("ev_anom", "🔎", "Datos raros", "Datos raros",
      `${num(val("r4c_excluded"))} registros apartados: visitas después de fallecer (se avisa al hospital) y altas anotadas antes del ingreso. Las altas repetidas del hospital H3 (un fallo al cambiar de sistema) ya se juntan solas.`,
      `${num(val("r4c_excluded"))} rexistros apartados: visitas despois de falecer (avísase ao hospital) e altas anotadas antes do ingreso. As altas repetidas do hospital H3 (un fallo ao cambiar de sistema) xa se xuntan soas.`);
    const s = this.stats;
    if (done("r4d_codigo") && s) add("ev_rate", "📊", "La cifra", "A cifra",
      `${pct(s.r, s.n, lang)} % de reingresos: ${num(s.r)} de ${num(s.n)} altas (${s.years}), ya sin los datos raros.`,
      `${pct(s.r, s.n, lang)} % de reingresos: ${num(s.r)} de ${num(s.n)} altas (${s.years}), xa sen os datos raros.`);
    if (done("r5a_kpi") && s) {
      const kpi = Object.fromEntries((led.find((l) => l.lock_id === "r5a_kpi")?.choice ?? "").split(";").map((x) => x.split("=")));
      const min = Number(String(this.e.kvGet(teamId, "kpi_min") ?? kpi.min_n ?? "30").replace(/^n/, "")) || 30;
      const ok = s.centers.filter((c) => c.n >= min).sort((a, b) => b.r / b.n - a.r / a.n);
      const small = s.centers.filter((c) => c.n < min);
      const top = ok[0], low = ok[ok.length - 1];
      if (top) add("ev_where", "🏥", "Dónde", "Onde",
        `Más reingresos: ${top.name} (${pct(top.r, top.n, lang)} %, ${num(top.n)} altas). Menos: ${low.name} (${pct(low.r, low.n, lang)} %).${small.length ? ` ${small.map((c) => c.name).join(", ")}: solo ${small.map((c) => c.n).join(", ")} altas, no se puede comparar (vuestro mínimo: ${min}).` : ""}`,
        `Máis reingresos: ${top.name} (${pct(top.r, top.n, lang)} %, ${num(top.n)} altas). Menos: ${low.name} (${pct(low.r, low.n, lang)} %).${small.length ? ` ${small.map((c) => c.name).join(", ")}: só ${small.map((c) => c.n).join(", ")} altas, non se pode comparar (o voso mínimo: ${min}).` : ""}`);
      const ages = [...s.ages].sort((a, b) => b.r / b.n - a.r / a.n);
      if (ages.length > 1) add("ev_age", "👥", "Por edad", "Por idade",
        `Más reingresos entre ${ages[0].band} años (${pct(ages[0].r, ages[0].n, lang)} %); menos entre ${ages[ages.length - 1].band} (${pct(ages[ages.length - 1].r, ages[ages.length - 1].n, lang)} %).`,
        `Máis reingresos entre ${ages[0].band} anos (${pct(ages[0].r, ages[0].n, lang)} %); menos entre ${ages[ages.length - 1].band} (${pct(ages[ages.length - 1].r, ages[ages.length - 1].n, lang)} %).`);
    }
    if (done("r5c_critico")) {
      let charts: string[] = [];
      try { charts = (JSON.parse(this.e.kvGet(teamId, "dash") ?? "{}").charts ?? []).map((c: any) => chartTitle(c, lang)); } catch { /* none */ }
      add("ev_dash", "📈", "Vuestro dashboard", "O voso dashboard", `${charts.length ? charts.join(" · ") : "Revisado por el crítico"}.`, `${charts.length ? charts.join(" · ") : "Revisado polo crítico"}.`);
    }
    if (done("r6c_equidad") && prog.r6c_equidad.points > 0) add("ev_ml", "🤖", "Aviso de riesgo (bonus)", "Aviso de risco (bonus)",
      "Un modelo que avisa al dar el alta de quién tiene más riesgo de volver. No acierta igual con todos los grupos: una persona revisa los avisos antes de llamar.",
      "Un modelo que avisa ao dar a alta de quen ten máis risco de volver. Non acerta igual con todos os grupos: unha persoa revisa os avisos antes de chamar.");
    return out;
  }

  // ---------- questions ----------
  private facts(teamId: string, lang: Lang) {
    const prog = this.e.progress(teamId), led = this.e.ledger(teamId), m = this.e.meterValues(teamId);
    const r1b = led.find((l) => l.lock_id === "r1b_reenvio")?.tag;
    const kpi = Object.fromEntries((led.find((l) => l.lock_id === "r5a_kpi")?.choice ?? "").split(";").map((p) => p.split("=")));
    const masters = Object.values(prog).filter((p) => p.master).length;
    const hints = Object.values(prog).reduce((a, p) => a + p.hints, 0);
    const privacyCritical = this.e.eventCount(teamId, "privacy_critical") > 0;
    const mlUsed = prog.r6c_equidad?.status === "done" && prog.r6c_equidad.points > 0;
    const lines = [
      "Resumen que el equipo tiene a la vista:", ...this.evidence(teamId, "es").map((c) => `- ${c.title}: ${c.text}`),
      `Decisión sobre ficheros reenviados: ${r1b ?? "sin registrar"}`, `Fallo grave de privacidad: ${privacyCritical ? "sí" : "no"}`,
      `Indicador: ${JSON.stringify(kpi)}`, `Llaves maestras usadas: ${masters}; pistas pedidas: ${hints}`,
      `Confianza de la Comisión: ${m.trust}/100`, `Laboratorio de riesgo (modelo predictivo) completado: ${mlUsed ? "sí" : "no"}`,
    ];
    return { r1b, kpi, masters, hints, privacyCritical, mlUsed, meters: m, text: lines.join("\n"), lang };
  }
  /** Five functional questions (what a non-technical client asks); the wording depends on what the team decided. */
  private pickKey(_personaId: string, idx: number, f: ReturnType<Commission["facts"]>): string {
    if (idx === 0) return "q_cifra";
    if (idx === 1) return f.r1b === "duplicates_ignored" || f.r1b === "partial_dedupe" ? "q_fiar_dup" : "q_fiar_ok";
    if (idx === 2) return "q_donde";
    if (idx === 3) return f.privacyCritical ? "q_priv_bad" : "q_priv_ok";
    return f.mlUsed ? "q_next_ml" : "q_next";
  }
  private rows(teamId: string) {
    return this.e.db.prepare("SELECT * FROM commission_turns WHERE team_id=? ORDER BY turn").all(teamId) as any[];
  }
  private async ensureQuestion(teamId: string, lang: Lang) {
    const rows = this.rows(teamId);
    const turn = rows.length ? (rows[rows.length - 1].answer === null ? rows.length - 1 : rows.length) : 0;
    if (turn >= this.cfg.turns) return;
    if (rows[turn]) return; // question already asked, waiting for the answer
    const personaId = this.cfg.order[turn % this.cfg.order.length];
    const persona = this.persona(personaId);
    const f = this.facts(teamId, lang);
    const key = this.pickKey(personaId, turn, f);
    const template = tr(this.cfg.questions[key], lang);
    let text = template;
    if (this.ai) {
      const sys = fill(this.prompts.commission ?? "", {
        lang: lang === "gl" ? "gallego" : "español", personaName: persona.name, personaRole: tr(persona.role, lang), personaFocus: tr(persona.focus, lang),
        facts: f.text, templateQuestion: template, asked: rows.map((r) => r.question).join(" | ") || "(ninguna)",
      });
      const out = await this.ai.askJson(teamId, sys, "Haz tu pregunta ahora.", z.object({ text: z.string().min(10).max(500) }), 2000);
      if (out) text = scrubOutput(out.text);
    }
    this.e.db.prepare("INSERT INTO commission_turns(team_id,turn,persona,qkey,question,answer,evidence_json,scores_json,vote,ts) VALUES(?,?,?,?,?,NULL,NULL,NULL,NULL,?)").run(teamId, turn, personaId, key, text, this.e.now());
  }

  async view(teamId: string, lang: Lang): Promise<CommissionView> {
    const lock = this.lockState(teamId);
    if (lock.status !== "done") await this.ensureQuestion(teamId, lang);
    const rows = this.rows(teamId), ev = this.evidence(teamId, lang);
    const answered = rows.filter((r) => r.answer !== null);
    const cur = rows.find((r) => r.answer === null);
    const view: CommissionView = {
      total: this.cfg.turns, turn: answered.length, done: lock.status === "done", evidence: ev,
      history: answered.map((r) => ({ persona: this.persona(r.persona).name, question: r.question, answer: r.answer, evidence: JSON.parse(r.evidence_json ?? "[]"), hint: (() => { try { return JSON.parse(r.scores_json).hint || undefined; } catch { return undefined; } })() })),
    };
    if (cur) { const p = this.persona(cur.persona), tip = this.cfg.tips?.[cur.turn]; view.question = { persona: { id: p.id, name: p.name, role: tr(p.role, lang) }, text: cur.question, tip: tip ? tr(tip, lang) : undefined }; }
    if (view.done) view.result = JSON.parse(String((this.e.db.prepare("SELECT payload_json FROM events_log WHERE team_id=? AND type='commission_result' ORDER BY id DESC LIMIT 1").get(teamId) as any)?.payload_json ?? "null")) ?? undefined;
    if (view.result) view.result = this.localizeResult(view.result, lang);
    return view;
  }

  // ---------- evaluation ----------
  private scriptedEval(answer: string): Evaluation {
    const t = plain(answer);
    const sentences = (answer.match(/[.!?]+/g) ?? []).length, words = answer.trim().split(/\s+/).length;
    const clarity = clamp((answer.length >= 60 ? 1 : 0) + (sentences >= 2 ? 1 : 0) + (words >= 15 ? 1 : 0), 0, 3);
    const evidence = clamp((/\d/.test(answer) ? 1 : 0) + ((answer.match(/\d+/g) ?? []).length >= 2 || /%|de cada/.test(t) ? 1 : 0) + (/(dato|registro|hospital|centro|ficher|visita|paciente|nombre|codigo|alta|edad)/.test(t) ? 1 : 0), 0, 3);
    const hon = clamp((t.match(/(limit|provisional|no sabemos|incertidumbre|cautela|pocos casos|sintetic|no podemos asegurar|aproximad|margen|no estamos seguros|riesgo)/g) ?? []).length, 0, 3);
    const act = clamp((t.match(/(recomend|propon|propuesta|haria|siguiente paso|deberiam|plan |revisar|vigilar|accion|pediria|avisar|comprobar)/g) ?? []).length, 0, 3);
    const errors = FALSE_CLAIMS.filter((c) => c.re.test(t)).map((c) => c.es);
    const total = clarity + evidence + hon + act;
    const vote = errors.length ? -1 : total >= 8 ? 1 : total <= 3 ? -1 : 0;
    const hint = errors.length ? "Cuidado: alguna afirmación no coincide con los datos reales." : evidence < 2 ? "Apoyaos en una cifra de las tarjetas de abajo." : act === 0 ? "Terminad con una propuesta de qué hacer." : hon === 0 ? "Probad a decir algo que todavía no sabéis seguro." : "";
    return { scores: { clarity, evidence, honesty_about_limits: hon, actionability: act }, factual_errors: errors, followup_hint: hint, vote_signal: vote };
  }
  private async evaluate(teamId: string, question: string, answer: string, lang: Lang): Promise<Evaluation> {
    const base = this.scriptedEval(answer);
    if (!this.ai) return base;
    const summary = this.evidence(teamId, lang).map((c) => `${c.title}: ${c.text}`).join("\n") || "(ninguno)";
    const sys = fill(this.prompts.commission_eval ?? "", { lang: lang === "gl" ? "gallego" : "español", groundTruth: GROUND_TRUTH[lang], question, evidence: summary });
    const out = await this.ai.askJson(teamId, sys, `<jugador>${answer}</jugador>`, EvalSchema, 2000);
    if (!out) return base;
    const sc = (n: number) => clamp(Math.round(n), 0, 3);
    // rule-based factual checks stay authoritative; the model adds nuance
    const errors = [...new Set([...base.factual_errors, ...out.factual_errors.map((x) => x.slice(0, 160))])];
    const total = sc(out.scores.clarity) + sc(out.scores.evidence) + sc(out.scores.honesty_about_limits) + sc(out.scores.actionability);
    const vote = errors.length ? -1 : total >= 8 ? 1 : total <= 3 ? -1 : 0;
    return { scores: { clarity: sc(out.scores.clarity), evidence: sc(out.scores.evidence), honesty_about_limits: sc(out.scores.honesty_about_limits), actionability: sc(out.scores.actionability) }, factual_errors: errors, followup_hint: scrubOutput(out.followup_hint || base.followup_hint).slice(0, 220), vote_signal: vote };
  }

  async answer(teamId: string, text: string, evidenceIds: string[], lang: Lang): Promise<CommissionView> {
    const lock = this.lockState(teamId);
    if (lock.status === "done") throw new GameError(409, "finished", "La Comisión ya ha votado");
    const clean = text.trim();
    if (clean.length < 10) throw new GameError(400, "too_short", lang === "gl" ? "Escribe unha resposta un pouco máis longa." : "Escribe una respuesta un poco más larga.");
    if (clean.length > 400) throw new GameError(400, "too_long", lang === "gl" ? "Máximo 400 letras." : "Máximo 400 letras.");
    const bad = inputProblem(clean);
    if (bad && bad !== "injection") throw new GameError(400, "bad_input", lang === "gl" ? "Non escribas datos persoais, ligazóns nin teléfonos." : "No escribáis datos personales, enlaces ni teléfonos.");
    await this.ensureQuestion(teamId, lang);
    const cur = this.rows(teamId).find((r) => r.answer === null);
    if (!cur) throw new GameError(409, "no_question", "No hay pregunta pendiente");
    void evidenceIds; // older clients still send attached cards: the summary is now always visible
    const ev = await this.evaluate(teamId, cur.question, clean, lang);
    this.e.db.prepare("UPDATE commission_turns SET answer=?, evidence_json=?, scores_json=?, vote=?, ts=? WHERE team_id=? AND turn=?")
      .run(clean, "[]", JSON.stringify({ ...ev.scores, errors: ev.factual_errors, hint: ev.followup_hint }), ev.vote_signal, this.e.now(), teamId, cur.turn);
    this.e.logAi(teamId, "commission", "f_comision", "user", clean);
    if (cur.turn + 1 >= this.cfg.turns) await this.finalize(teamId, lang);
    else this.e.notifyTeam(teamId);
    return this.view(teamId, lang);
  }

  // ---------- ending, badges, report ----------
  private badges(teamId: string): string[] {
    const p = this.e.progress(teamId), has = (id: string) => p[id]?.status === "done" && p[id].points > 0;
    const out: string[] = [];
    if (has("r1c_ada") && p.r1c_ada.attempts <= 1) out.push("ojo_halcon");
    if (has("r2a_radar") && this.e.eventCount(teamId, "privacy_critical") === 0) out.push("cero_fugas");
    if (has("r1c_ada")) out.push("auditor_ia");
    if (has("r4b_entrevistas") && has("r4c_veredicto")) out.push("detective");
    if (!Object.values(p).some((x) => x.master)) out.push("sin_atajos");
    if (has("r3b_estrella") && p.r3b_estrella.attempts <= 1) out.push("esquema_estelar");
    if (has("r5c_critico") && p.r5c_critico.attempts <= 1) out.push("cartografo");
    if (has("r6c_equidad")) out.push("etica_primero");
    return out;
  }
  private scriptedReport(teamId: string, lang: Lang, ending: string, badgeIds: string[]): string {
    const f = this.facts(teamId, lang), gl = lang === "gl";
    const strengths: string[] = [];
    if (!f.privacyCritical) strengths.push(gl ? "protexestes os datos persoais antes de analizalos" : "protegisteis los datos personales antes de analizarlos");
    if (f.r1b === "correct_dedupe") strengths.push(gl ? "resolvestes ben os ficheiros reenviados quedando coa última versión" : "resolvisteis bien los ficheros reenviados quedándoos con la última versión");
    if (this.minOk(f.kpi.min_n)) strengths.push(gl ? "definistes un indicador honesto cun mínimo de altas" : "definisteis un indicador honesto con un mínimo de altas");
    if (f.mlUsed) strengths.push(gl ? "revistes a equidade do modelo antes de usalo" : "revisasteis la equidad del modelo antes de usarlo");
    if (badgeIds.includes("sin_atajos")) strengths.push(gl ? "chegastes sen usar a chave mestra" : "llegasteis sin usar la llave maestra");
    for (const s of [gl ? "comprobastes o que dicía a IA cos datos" : "comprobasteis lo que decía la IA con los datos", gl ? "investigastes as anomalías en lugar de borralas sen máis" : "investigasteis las anomalías en lugar de borrarlas sin más", gl ? "traballastes en equipo cun método claro" : "trabajasteis en equipo con un método claro"]) if (strengths.length < 3) strengths.push(s);
    const improve = [
      f.privacyCritical ? (gl ? "coidar desde o principio os datos que identifican persoas" : "cuidar desde el principio los datos que identifican a personas") : (gl ? "documentar cada decisión con unha cifra que a apoie" : "documentar cada decisión con una cifra que la respalde"),
      f.hints >= 6 || f.masters > 0 ? (gl ? "pedir menos axudas: probar primeiro e preguntar despois" : "pedir menos ayudas: probar primero y preguntar después") : (gl ? "recoñecer sempre os límites dos datos ao comunicalos" : "reconocer siempre los límites de los datos al comunicarlos"),
    ];
    return gl
      ? `Equipo, defendestes o voso traballo ante a Comisión. Fortalezas: ${strengths.slice(0, 3).join("; ")}. A mellorar: ${improve.join("; ")}. Profesións que viviches hoxe: enxeñaría de datos (cargar e modelar datos: FP de Informática ou Grao en Enxeñaría Informática), goberno do dato e privacidade (Dereito, Estatística ou Informática con especialización en protección de datos), análise e BI (Estatística, Economía ou FP de Datos) e ciencia de datos (Matemáticas, Estatística ou Ciencia de Datos). Os datos son sintéticos e modificáronse para o xogo.`
      : `Equipo, habéis defendido vuestro trabajo ante la Comisión. Fortalezas: ${strengths.slice(0, 3).join("; ")}. A mejorar: ${improve.join("; ")}. Profesiones que habéis vivido hoy: ingeniería de datos (cargar y modelar datos: FP de Informática o Grado en Ingeniería Informática), gobierno del dato y privacidad (Derecho, Estadística o Informática con especialización en protección de datos), análisis y BI (Estadística, Economía o FP de Datos) y ciencia de datos (Matemáticas, Estadística o Ciencia de Datos). Los datos son sintéticos y se modificaron para el juego.`;
  }
  private async finalize(teamId: string, lang: Lang) {
    const rows = this.rows(teamId), m = this.e.meterValues(teamId);
    const votes = this.cfg.personas.map((p) => {
      const sum = rows.filter((r) => r.persona === p.id).reduce((a, r) => a + Number(r.vote ?? 0), 0);
      return { persona: p.id, vote: sum > 0 ? 1 : sum < 0 ? -1 : 0 };
    });
    const sc = votes.reduce((a, v) => a + v.vote, 0) + (m.trust >= 80 ? 2 : m.trust >= 60 ? 1 : m.trust < 35 ? -1 : 0);
    const ending = sc >= 3 ? "approved" : sc >= 0 ? "conditions" : "more_data";
    const badgeIds = this.badges(teamId);
    this.e.addPoints(teamId, 2 * Math.min(10, badgeIds.length));
    let report = "";
    if (this.ai) {
      const summary = `${this.facts(teamId, lang).text}\nVeredicto de la Comisión: ${ending}\nInsignias: ${badgeIds.join(", ") || "ninguna"}`;
      const out = await this.ai.askJson(teamId, fill(this.prompts.commission_report ?? "", { lang: lang === "gl" ? "gallego" : "español", teamSummary: summary }), "Redacta el informe.", z.object({ text: z.string().min(40).max(1800) }), 2500);
      if (out) report = scrubOutput(out.text);
    }
    if (!report) report = this.scriptedReport(teamId, lang, ending, badgeIds);
    const result = { ending, votes, report, badges: badgeIds, score: this.e.teamScore(teamId) };
    this.e.logEvent(teamId, "commission_result", result);
    this.e.finishLock(teamId, "f_comision", this.e.content.locks.get("f_comision")?.points ?? 0);
    result.score = this.e.teamScore(teamId);
    this.e.db.prepare("UPDATE events_log SET payload_json=? WHERE id=(SELECT MAX(id) FROM events_log WHERE team_id=? AND type='commission_result')").run(JSON.stringify(result), teamId);
  }
  private localizeResult(raw: any, lang: Lang): CommissionResult {
    const e = this.cfg.endings[raw.ending];
    return {
      ending: raw.ending, title: tr(e.title, lang), text: tr(e.text, lang), report: raw.report, score: raw.score,
      votes: raw.votes.map((v: any) => ({ persona: this.persona(v.persona).name, vote: v.vote })),
      badges: raw.badges.map((id: string) => ({ id, name: this.cfg.badges[id][lang], why: tr(this.cfg.badges[id].why, lang) })),
    };
  }
}
