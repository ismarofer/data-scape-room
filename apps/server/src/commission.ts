import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { tr, type Lang, type LTextT } from "@codigo-alta/shared";
import { Engine, GameError } from "./engine.js";
import type { AiService } from "./ai/service.js";
import { fill } from "./ai/characters.js";
import { inputProblem, scrubOutput } from "./ai/moderation.js";

interface Persona { id: string; name: string; role: LTextT; focus: LTextT }
interface CommissionCfg {
  turns: number; personas: Persona[]; order: string[]; questions: Record<string, LTextT>;
  endings: Record<string, { title: LTextT; text: LTextT }>; badges: Record<string, { es: string; gl: string; why: LTextT }>;
}
export const loadCommission = (contentDir: string): CommissionCfg => YAML.parse(fs.readFileSync(path.join(contentDir, "commission.yaml"), "utf8"));

export interface EvidenceCard { id: string; title: string; text: string }
export interface CommissionView {
  total: number; turn: number; done: boolean;
  question?: { persona: { id: string; name: string; role: string }; text: string };
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
  es: "El hospital tiene 9 centros. Hay 9 003 personas distintas (9 015 fichas: hay duplicadas). Hay ingresos sin fecha de alta. El reingreso se define a 2-30 días naturales tras el alta, solo ingresos inpatient. Hay registros posteriores al fallecimiento por retraso en el registro de defunciones, y una migración duplicó marcas en el centro H3. Un centro con 3 ingresos tiene 100 % de tasa por azar y no es comparable.",
  gl: "O hospital ten 9 centros. Hai 9 003 persoas distintas (9 015 fichas: hai duplicadas). Hai ingresos sen data de alta. O reingreso defínese a 2-30 días naturais tras a alta, só ingresos inpatient. Hai rexistros posteriores ao falecemento por atraso no rexistro de defuncións, e unha migración duplicou marcas no centro H3. Un centro con 3 ingresos ten 100 % de taxa por azar e non é comparable.",
};
const FALSE_CLAIMS: { re: RegExp; es: string }[] = [
  { re: /9\.?\s?015\s+(pacientes|personas)\s+(unic|distint)/, es: "Hay 9 015 pacientes únicos (en realidad hay 9 003 personas distintas)." },
  { re: /(ningun|no hay)\s+ingreso[s]?\s+(sin|con la fecha de alta vacia)/, es: "No hay ingresos sin fecha de alta (sí los hay)." },
  { re: /(centro pequeno|illas cies).{0,40}(el peor|mayor tasa real|peor hospital)/, es: "El centro pequeño es el peor (su tasa es azar de pocos casos)." },
];

export class Commission {
  constructor(private e: Engine, private ai: AiService | undefined, private cfg: CommissionCfg, private prompts: Record<string, string>) {}

  private lockState(teamId: string) {
    const p = this.e.progress(teamId).f_comision;
    if (!p || p.status === "locked") throw new GameError(409, "not_yet", "La Comisión todavía no os espera");
    return p;
  }
  private persona(id: string) { return this.cfg.personas.find((p) => p.id === id)!; }

  // ---------- evidence cards (what the team can attach) ----------
  evidence(teamId: string, lang: Lang): EvidenceCard[] {
    const prog = this.e.progress(teamId), led = this.e.ledger(teamId), gl = lang === "gl";
    const done = (id: string) => prog[id]?.status === "done" && (prog[id].points > 0 || !prog[id].master);
    const out: EvidenceCard[] = [];
    const dec = led.find((l) => l.lock_id === "r1b_reenvio");
    if (dec) { const opt = this.e.content.locks.get("r1b_reenvio")?.decision?.options.find((o) => o.ledger_tag === dec.tag); out.push({ id: "ev_dedupe", title: gl ? "Decisión sobre o reenvío" : "Decisión sobre el reenvío", text: opt ? tr(opt.label, lang) : "" }); }
    if (done("r1c_ada")) out.push({ id: "ev_ai", title: gl ? "Auditoría de Ada" : "Auditoría de Ada", text: gl ? "Comprobastes as afirmacións de Ada cos datos e detectastes as falsas." : "Comprobasteis las afirmaciones de Ada con los datos y detectasteis las falsas." });
    if (done("r2a_radar")) out.push({ id: "ev_privacy", title: gl ? "Radar RXPD" : "Radar RGPD", text: gl ? "Clasificastes as 19 columnas de pacientes (eliminar, pseudonimizar, xeneralizar, manter)." : "Clasificasteis las 19 columnas de pacientes (eliminar, pseudonimizar, generalizar, mantener)." });
    if (done("r4c_veredicto")) out.push({ id: "ev_verdict", title: gl ? "Veredicto das anomalías" : "Veredicto de las anomalías", text: gl ? "Decidistes como tratar cada grupo de anomalías e documentástelo." : "Decidisteis cómo tratar cada grupo de anomalías y lo documentasteis." });
    if (done("r5a_kpi")) out.push({ id: "ev_kpi", title: gl ? "Indicador definido" : "Indicador definido", text: gl ? "Taxa sobre altas, con mínimo de altas e aviso para centros pequenos." : "Tasa sobre altas, con mínimo de altas y aviso para centros pequeños." });
    if (done("r5c_critico")) out.push({ id: "ev_dash", title: gl ? "Dashboard revisado" : "Dashboard revisado", text: gl ? "O voso cadro de mando pasou a revisión do crítico." : "Vuestro cuadro de mando pasó la revisión del crítico." });
    if (done("r6a_entrenar")) out.push({ id: "ev_ml", title: gl ? "Modelo sen fuga de datos" : "Modelo sin fuga de datos", text: gl ? "Adestrastes un modelo usando só o que se sabe no momento da alta." : "Entrenasteis un modelo usando solo lo que se sabe en el momento del alta." });
    if (done("r6c_equidad")) out.push({ id: "ev_equity", title: gl ? "Revisión de equidade" : "Revisión de equidad", text: gl ? "Revistes a sensibilidade por sexo e idade antes de usar o modelo." : "Revisasteis la sensibilidad por sexo y edad antes de usar el modelo." });
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
      `Decisión sobre ficheros reenviados: ${r1b ?? "sin registrar"}`, `Fallo grave de privacidad: ${privacyCritical ? "sí" : "no"}`,
      `Indicador: ${JSON.stringify(kpi)}`, `Llaves maestras usadas: ${masters}; pistas pedidas: ${hints}`,
      `Medidores: confianza ${m.trust}, cumplimiento ${m.compliance}, calidad ${m.quality}`, `Laboratorio de riesgo (modelo predictivo) completado: ${mlUsed ? "sí" : "no"}`,
    ];
    return { r1b, kpi, masters, hints, privacyCritical, mlUsed, meters: m, text: lines.join("\n"), lang };
  }
  private pickKey(personaId: string, idx: number, f: ReturnType<Commission["facts"]>): string {
    if (idx === 0) return f.r1b === "duplicates_ignored" || f.r1b === "partial_dedupe" ? "v1_dup" : "v1_ok";
    if (idx === 1) return f.privacyCritical ? "p1_priv_bad" : "p1_priv_ok";
    if (idx === 2) return "l1_anom";
    if (idx === 3) return f.kpi.min_n !== "n30" || ["show", "hide"].includes(f.kpi.small_center) ? "v2_small_bad" : "v2_small_ok";
    if (idx === 4) return f.masters > 0 || f.hints >= 6 ? "p2_time" : "p2_cost";
    return f.mlUsed ? "l2_ml" : "l2_action";
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
    if (cur) { const p = this.persona(cur.persona); view.question = { persona: { id: p.id, name: p.name, role: tr(p.role, lang) }, text: cur.question }; }
    if (view.done) view.result = JSON.parse(String((this.e.db.prepare("SELECT payload_json FROM events_log WHERE team_id=? AND type='commission_result' ORDER BY id DESC LIMIT 1").get(teamId) as any)?.payload_json ?? "null")) ?? undefined;
    if (view.result) view.result = this.localizeResult(view.result, lang);
    return view;
  }

  // ---------- evaluation ----------
  private scriptedEval(answer: string, evidenceCount: number): Evaluation {
    const t = plain(answer);
    const sentences = (answer.match(/[.!?]+/g) ?? []).length, words = answer.trim().split(/\s+/).length;
    const clarity = clamp((answer.length >= 60 ? 1 : 0) + (sentences >= 2 ? 1 : 0) + (words >= 15 ? 1 : 0), 0, 3);
    const evidence = clamp((/\d/.test(answer) ? 1 : 0) + (evidenceCount >= 1 ? 1 : 0) + (evidenceCount >= 2 || /(dato|tabla|consulta|test|prueba|grafico|decision|auditor)/.test(t) ? 1 : 0), 0, 3);
    const hon = clamp((t.match(/(limit|provisional|no sabemos|incertidumbre|cautela|pocos casos|sintetic|no podemos asegurar|aproximad|margen|no estamos seguros|riesgo)/g) ?? []).length, 0, 3);
    const act = clamp((t.match(/(recomend|propon|propuesta|haria|siguiente paso|deberiam|plan |revisar|vigilar|accion|pediria|avisar|comprobar)/g) ?? []).length, 0, 3);
    const errors = FALSE_CLAIMS.filter((c) => c.re.test(t)).map((c) => c.es);
    const total = clarity + evidence + hon + act;
    const vote = errors.length ? -1 : total >= 8 ? 1 : total <= 3 ? -1 : 0;
    const hint = errors.length ? "Cuidado: alguna afirmación no coincide con los datos reales." : hon === 0 ? "Probad a reconocer algún límite de vuestros datos." : act === 0 ? "Terminad con una propuesta de qué hacer." : evidence < 2 ? "Apoyaos en una cifra o adjuntad una tarjeta de evidencia." : "";
    return { scores: { clarity, evidence, honesty_about_limits: hon, actionability: act }, factual_errors: errors, followup_hint: hint, vote_signal: vote };
  }
  private async evaluate(teamId: string, question: string, answer: string, evidenceTitles: string[], lang: Lang): Promise<Evaluation> {
    const base = this.scriptedEval(answer, evidenceTitles.length);
    if (!this.ai) return base;
    const sys = fill(this.prompts.commission_eval ?? "", { lang: lang === "gl" ? "gallego" : "español", groundTruth: GROUND_TRUTH[lang], question, evidence: evidenceTitles.join("; ") || "(ninguna)" });
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
    const valid = this.evidence(teamId, lang), attached = valid.filter((c) => evidenceIds.includes(c.id)).slice(0, 3);
    const ev = await this.evaluate(teamId, cur.question, clean, attached.map((c) => c.title), lang);
    this.e.db.prepare("UPDATE commission_turns SET answer=?, evidence_json=?, scores_json=?, vote=?, ts=? WHERE team_id=? AND turn=?")
      .run(clean, JSON.stringify(attached.map((c) => c.id)), JSON.stringify({ ...ev.scores, errors: ev.factual_errors, hint: ev.followup_hint }), ev.vote_signal, this.e.now(), teamId, cur.turn);
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
    if (has("r4a_pruebas") && has("r4c_veredicto")) out.push("detective");
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
    if (f.kpi.min_n === "n30") strengths.push(gl ? "definistes un indicador honesto cun mínimo de altas" : "definisteis un indicador honesto con un mínimo de altas");
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
    const sc = votes.reduce((a, v) => a + v.vote, 0) + (m.trust >= 70 ? 1 : m.trust < 40 ? -1 : 0) + (m.quality >= 60 ? 1 : m.quality < 35 ? -1 : 0) + (m.compliance < 50 ? -1 : 0);
    const ending = sc >= 3 ? "approved" : sc >= 0 ? "conditions" : "more_data";
    const badgeIds = this.badges(teamId);
    this.e.addPoints(teamId, 10 * Math.min(10, badgeIds.length));
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
