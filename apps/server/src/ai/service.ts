import { z } from "zod";
import { evaluateDashboard, guardSql, tr, type DashboardSpec, type Finding, type Lang } from "@codigo-alta/shared";
import type { Engine } from "../engine.js";
import { fill, revealedBy, scriptedNpc, type Character } from "./characters.js";
import type { ChatTurn, Llm } from "./llm.js";
import { asksForAnswer, inputProblem, scrubOutput } from "./moderation.js";
import { itemWords } from "./labels.js";

export interface AiOpts {
  llm?: Llm;
  characters: Record<string, Character>;
  prompts: Record<string, string>;
  budgetEur: number;
  priceEurPer1k: number;
  timeoutMs?: number;
  perMinute?: number;
}
export type Source = "live" | "scripted" | "off";
/** What the player's browser reports about its own workspace (data tables, last lab query). Untrusted text: it is only shown to the model as data. */
export interface WorkContext {
  tables?: { name: string; rows: number }[]; lastQuery?: { sql: string; result: string } | null;
  /** what the team is building in the open level right now, in the same format the level submits (checked by the server, never trusted) */
  draft?: string;
  /** the same draft in plain words, for the model */
  draftText?: string;
  /** what the player has open in the centre (a file, a table, a solved level) */
  view?: string;
}
const clean = (t: string, n: number) => t.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
function workText(w?: WorkContext): string {
  if (!w) return "";
  const out: string[] = [];
  if (w.tables?.length) out.push(`Tablas en la base de datos del navegador: ${w.tables.slice(0, 25).map((t) => `${clean(t.name, 60)} (${Number(t.rows) || 0} filas)`).join(", ")}.`);
  else out.push("Todavía no hay tablas cargadas en la base de datos del navegador.");
  if (w.lastQuery?.sql) out.push(`Última pregunta hecha en el laboratorio: «${clean(w.lastQuery.sql, 500)}» → resultado: ${clean(w.lastQuery.result, 300)}.`);
  if (w.view) out.push(`Pestaña que tiene abierta ahora: ${clean(w.view, 120)}.`);
  return out.join("\n");
}

const MSGS: Record<string, Record<Lang, string>> = {
  pii: { es: "Mejor no escribas datos personales (nombres, teléfonos, correos o enlaces). Cuéntame qué has hecho con los datos del caso.", gl: "Mellor non escribas datos persoais (nomes, teléfonos, correos ou ligazóns). Cóntame que fixeches cos datos do caso." },
  injection: { es: "¡Buen intento! 😄 Mis reglas no se tocan, pero sí os ayudo: contadme qué habéis probado y os digo por dónde seguir.", gl: "Bo intento! 😄 As miñas regras non se tocan, pero si vos axudo: contádeme que probastes e dígovos por onde seguir." },
  empty: { es: "Escribe tu pregunta y te ayudo.", gl: "Escribe a túa pregunta e axúdote." },
  too_long: { es: "Cuéntamelo más corto, en una o dos frases.", gl: "Cóntamo máis curto, nunha ou dúas frases." },
  slow: { es: "Voy un poco justa de tiempo: probad y volved a preguntarme en un momento.", gl: "Vou un pouco xusta de tempo: probade e volvede preguntarme nun momento." },
  no_credits: { es: "Os habéis quedado sin créditos de IA. Ada ya no puede ayudar; seguid con vuestros datos.", gl: "Quedastes sen créditos de IA. Ada xa non pode axudar; seguide cos vosos datos." },
  npc_done: { es: "Ya no me quedan más minutos para vosotros, lo siento.", gl: "Xa non me quedan máis minutos para vós, síntoo." },
  leak: { es: "¡Uy, casi os lo digo todo! 😅 Si queréis la respuesta entera, pulsad «Dame una pista» o «Ver la solución». Mientras, contadme qué os sale y lo miramos juntos.", gl: "Uy, case vos o digo todo! 😅 Se queredes a resposta enteira, premede «Dame unha pista» ou «Ver a solución». Mentres, contádeme que vos sae e mirámolo xuntos." },
};
const m = (k: string, lang: Lang) => MSGS[k][lang];

export class AiService {
  private calls = new Map<string, number[]>();
  constructor(private e: Engine, private o: AiOpts) {}

  private rateLimited(teamId: string) {
    const now = Date.now();
    const arr = (this.calls.get(teamId) ?? []).filter((t) => now - t < 60_000);
    arr.push(now);
    this.calls.set(teamId, arr);
    return arr.length > (this.o.perMinute ?? 8);
  }
  /** The AI is always live. It falls back to the fixed texts only if the model is not configured, the budget is spent, or a call fails. */
  private liveOk(teamId: string) {
    const c = this.e.aiContext(teamId);
    if (!this.o.llm) return false;
    const spent = (this.e.aiTokensForSession(c.sessionId) / 1000) * this.o.priceEurPer1k;
    if (spent >= this.o.budgetEur) return false; // budget spent: the game keeps going with the fixed texts
    return !this.rateLimited(teamId);
  }
  private async llm<T>(teamId: string, tier: "fast" | "smart", system: string, user: string, schema: z.ZodType<T, z.ZodTypeDef, any>, maxTokens = 400, history?: ChatTurn[]): Promise<T | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), this.o.timeoutMs ?? 12_000);
      try {
        const r = await this.o.llm!.complete({ system, user, history, json: true, maxTokens, tier, signal: ctl.signal });
        this.e.logAi(teamId, "_usage", null, "assistant", "", r.tokens);
        const parsed = schema.safeParse(JSON.parse(r.text));
        if (parsed.success) return parsed.data;
      } catch { /* retry once, then null -> scripted */ } finally { clearTimeout(timer); }
    }
    return null;
  }

  /** One JSON answer from the model for other services (the Commission). null = not live / failed: the caller falls back to its own rules. */
  async askJson<T>(teamId: string, system: string, user: string, schema: z.ZodType<T, z.ZodTypeDef, any>, maxTokens = 600): Promise<T | null> {
    if (!this.liveOk(teamId)) return null;
    return this.llm(teamId, "fast", system, user, schema, maxTokens);
  }

  // ---------- Lumi (tutor) ----------
  /**
   * Lumi knows the level, its full solution, what the team is building right now (checked by the server) and their last tries.
   * How far it may go is the help level the team has unlocked and asked for (levels 1-3 = the lock's hints, 4 = the solution).
   */
  async lumi(teamId: string, message: string, lang: Lang, work?: WorkContext): Promise<{ text: string; source: Source }> {
    const c = this.e.aiContext(teamId);
    const bad = inputProblem(message);
    if (bad) { this.e.logAi(teamId, "lumi", c.lock?.id ?? null, "user", bad === "injection" ? "[bloqueado: intento de saltar reglas]" : "[bloqueado]"); return { text: m(bad === "injection" ? "injection" : bad, lang), source: "scripted" }; }
    const history: ChatTurn[] = this.e.recentChat(teamId, "lumi", 8).map((t) => (t.role === "user" ? { role: "user" as const, content: `<jugador>${t.text}</jugador>` } : { role: "assistant" as const, content: JSON.stringify({ text: t.text }) }));
    this.e.logAi(teamId, "lumi", c.lock?.id ?? null, "user", message);
    if (c.lock) this.e.chargeAi(teamId, "lumi"); // every question to Lumi costs confidence (blocked messages do not)
    const lock = c.lock;
    const level = Math.min(4, c.hintsUsed);
    const granted = lock ? lock.hints.slice(0, Math.min(3, level)).map((h) => tr(h, lang)) : [];
    const diag = lock && work?.draft ? this.e.diagnose(teamId, work.draft, lang) : null;
    const tries = lock ? this.e.lastAttempts(teamId, lock.id, 3) : [];
    let text = "";
    let source: Source = "scripted";
    if (this.liveOk(teamId) && lock) {
      const guide = this.e.content.guides.locks[lock.id];
      const solution = this.e.solutionText(lock, lang) ?? (lang === "gl" ? "(este nivel non ten unha solución única)" : "(este nivel no tiene una solución única)");
      const sys = fill(this.o.prompts.lumi, {
        lang: lang === "gl" ? "gallego" : "español",
        lockTitle: tr(lock.title, lang),
        mission: tr(lock.story, lang).slice(0, 700),
        steps: guide ? guide.steps.map((x, i) => `${i + 1}. ${tr(x, lang)}`).join("\n").slice(0, 1400) : "",
        answerHint: lock.answer_hint ? tr(lock.answer_hint, lang) : "",
        helpLevel: String(level),
        grantedHelp: granted.length ? granted.map((h, i) => `${i + 1}) ${h}`).join(" | ") : "(ninguna todavía)",
        nextHelp: c.help?.next ? (c.help.next.unlocked ? `La ayuda ${c.help.next.level} ya está desbloqueada (baja ${c.help.next.penalty} la confianza): pueden pulsar «${c.help.next.level >= 4 ? "Ver la solución" : "Dame una pista"}».` : `La ayuda ${c.help.next.level} se desbloquea ${c.help.next.attemptsNeeded ? `tras ${c.help.next.attemptsNeeded} intento(s) fallido(s) más o ` : ""}en ${Math.ceil(c.help.next.waitSeconds / 60)} min.`) : "Ya tienen todas las ayudas, incluida la solución.",
        solution: solution.slice(0, 1600),
        draft: work?.draftText ? clean(work.draftText, 900) : work?.draft ? clean(work.draft, 900) : "(no hay nada a medio hacer en este nivel)",
        diagnosis: diag ? (diag.ok ? "CORRECTO: lo que tienen ahora resolvería el nivel." : `INCORRECTO en: ${diag.wrong.map((w) => itemWords(w, lang)).join(", ") || "—"}${diag.missing ? `; además faltan ${diag.missing} elemento(s)` : ""}.`) : "(sin borrador que comprobar)",
        attempts: tries.length ? tries.map((t) => `${t.ok ? "✔" : "✘"} «${clean(t.code, 160)}»${t.bad.length ? ` (mal: ${t.bad.slice(0, 8).map((b) => itemWords(b, lang)).join(", ")})` : ""}`).join(" | ") : "(aún no han entregado nada)",
        teamState: `${this.e.snapshot(teamId, lang)}\n${workText(work)}`.slice(0, 2400),
      });
      const out = await this.llm(teamId, "fast", sys + '\nResponde SOLO JSON: {"text": string}', `<jugador>${message}</jugador>`, z.object({ text: z.string().min(1).max(900) }), 260, history);
      if (out) {
        const t = scrubOutput(out.text);
        if (level < 4 && this.e.leaksAnswer(lock.id, t)) text = m("leak", lang);
        else { text = t; source = "live"; }
      }
    }
    if (!text) text = this.scriptedLumi(teamId, message, lang, diag, granted);
    this.e.logAi(teamId, "lumi", lock?.id ?? null, "assistant", text);
    return { text, source };
  }

  /** Lumi without the model: still useful — the steps, what is wrong in the current draft, or the last help given. */
  private scriptedLumi(teamId: string, message: string, lang: Lang, diag: ReturnType<Engine["diagnose"]>, granted: string[]): string {
    const gl = lang === "gl";
    const c = this.e.aiContext(teamId);
    const lock = c.lock;
    if (!lock) return gl ? "Xa non queda ningún nivel aberto. Bo traballo!" : "Ya no queda ningún nivel abierto. ¡Buen trabajo!";
    const msg = message.toLowerCase();
    const guide = this.e.content.guides.locks[lock.id];
    const level = Math.min(4, c.hintsUsed);
    if (level >= 4) return `${gl ? "Aquí tedes a solución:" : "Aquí tenéis la solución:"} ${this.e.solutionText(lock, lang) ?? ""}`;
    if (/(que|qué) (hay que|tengo que|tenemos que|teño que|temos que|hago|facemos|hacemos)|no entiendo|non entendo|como (se|empez|comez)|cómo|por donde|por dónde/.test(msg) && guide) {
      return `${gl ? "Neste nivel:" : "En este nivel:"} ${guide.steps.slice(0, 3).map((x, i) => `${i + 1}) ${tr(x, lang)}`).join(" ")}`;
    }
    if (diag) {
      if (diag.ok) return gl ? "O que tedes agora mesmo está ben. Entregádeo!" : "Lo que tenéis ahora mismo está bien. ¡Entregadlo!";
      const isDash = lock.validator?.type === "chart_rules";
      const what = isDash ? (gl ? `o crítico aínda ve ${diag.wrong.length} problema(s) nos gráficos` : `el crítico aún ve ${diag.wrong.length} problema(s) en los gráficos`) : diag.wrong.map((w) => itemWords(w, lang)).join(", ");
      const miss = diag.missing ? (gl ? ` Ademais, fáltanvos ${diag.missing} elemento(s).` : ` Además, os faltan ${diag.missing} elemento(s).`) : "";
      if (what) return `${gl ? "Mirei o que tedes: ides ben, só falta revisar" : "He mirado lo que tenéis: vais bien, solo falta revisar"} ${what}.${miss}${granted.length ? "" : gl ? " Se non sabedes como, pedídeme unha pista." : " Si no sabéis cómo, pedidme una pista."}`;
      if (miss) return miss.trim();
    }
    if (asksForAnswer(message)) {
      const n = c.help?.next;
      const how = !n ? "" : n.unlocked
        ? (gl ? ` Podedes premer «${n.level >= 4 ? "Ver a solución" : "Dame unha pista"}» (baixa ${n.penalty} a confianza).` : ` Podéis pulsar «${n.level >= 4 ? "Ver la solución" : "Dame una pista"}» (baja ${n.penalty} la confianza).`)
        : (gl ? ` A seguinte axuda ábrese ${n.attemptsNeeded ? `tras ${n.attemptsNeeded} intento(s) máis ou ` : ""}en ${Math.max(1, Math.ceil(n.waitSeconds / 60))} min.` : ` La siguiente ayuda se abre ${n.attemptsNeeded ? `tras ${n.attemptsNeeded} intento(s) más o ` : ""}en ${Math.max(1, Math.ceil(n.waitSeconds / 60))} min.`);
      const step = guide?.steps[0] ? (gl ? ` Para empezar: ${tr(guide.steps[0], lang)}` : ` Para empezar: ${tr(guide.steps[0], lang)}`) : "";
      return (gl ? "Imos achegarnos xuntos!" : "¡Vamos a acercarnos juntos!") + step + how;
    }
    const last = granted[granted.length - 1];
    if (last) return gl ? `Lembrade a última axuda: «${last}» Que probastes con ela?` : `Recordad la última ayuda: «${last}» ¿Qué habéis probado con ella?`;
    return gl
      ? "Contádeme que probastes e que vos sae. Se seguides atascados, premede «Dame unha pista»."
      : "Contadme qué habéis probado y qué os sale. Si seguís atascados, pulsad «Dame una pista».";
  }

  /** The team asks Lumi for the next step of help (hint 1-3 or the solution). The text is fixed content; it also goes into the chat. */
  helpStep(teamId: string, level: number, lang: Lang) {
    const r = this.e.hint(teamId, level, lang);
    const gl = lang === "gl";
    const head = level >= 4 ? (gl ? "🔑 Solución:" : "🔑 Solución:") : `💡 ${gl ? "Pista" : "Pista"} ${level}:`;
    const text = `${head} ${r.text}`;
    this.e.logAi(teamId, "lumi", r.lockId, "assistant", text);
    return { ...r, text };
  }

  // ---------- NPC interviews ----------
  async npc(teamId: string, npcId: string, message: string, lang: Lang) {
    const c = this.e.aiContext(teamId);
    const ch = this.o.characters[npcId];
    if (!ch) throw new Error("npc");
    const used = this.e.npcUserTurns(teamId, npcId);
    const left = (n: number) => Math.max(0, ch.max_questions - n);
    if (used >= ch.max_questions) return { text: m("npc_done", lang), revealed: [] as string[], left: 0, source: "scripted" as Source, done: false };
    const bad = inputProblem(message);
    if (bad && bad !== "injection") return { text: m(bad, lang), revealed: [] as string[], left: left(used), source: "scripted" as Source, done: false };
    this.e.logAi(teamId, npcId, c.lock?.id ?? null, "user", bad ? "[bloqueado: intento de saltar reglas]" : message);
    if (!bad) this.e.chargeAi(teamId, "npc");
    const already = this.e.clues(teamId);
    // authoritative reveal rule: always evaluated locally, never trusted from the model
    const sc = bad ? { text: m("injection", lang), revealed: [] as string[] } : scriptedNpc(ch, message, used, already, lang);
    let text = sc.text;
    let source: Source = "scripted";
    if (!bad && this.liveOk(teamId)) {
      const sys = fill(this.o.prompts.npc, {
        name: ch.name, role: tr(ch.role, lang), persona: tr(ch.persona, lang), lang: lang === "gl" ? "gallego" : "español",
        facts: JSON.stringify(ch.facts.map((f) => ({ id: f.id, text: tr(f.text, lang) }))),
        rules: JSON.stringify(ch.facts.map((f) => ({ id: f.id, reveal_when_player_message_mentions_all_groups: f.reveal_all }))),
      });
      const out = await this.llm(teamId, "fast", sys, `<jugador>${message}</jugador>`, z.object({ text: z.string().min(1).max(900), revealedClueIds: z.array(z.string()).default([]) }), 300);
      if (out) {
        const allowed = new Set(revealedBy(ch, message));
        const claimed = out.revealedClueIds.filter((id) => allowed.has(id));
        // keep the model's voice only if it agrees with the deterministic rule
        if (claimed.length === sc.revealed.length && out.revealedClueIds.every((id) => allowed.has(id))) { text = scrubOutput(out.text); source = "live"; }
      }
    }
    this.e.logAi(teamId, npcId, c.lock?.id ?? null, "assistant", text);
    const done = sc.revealed.length ? this.e.addClues(teamId, sc.revealed) : false;
    return { text, revealed: sc.revealed, left: left(used + 1), source, done };
  }
  greeting(npcId: string, lang: Lang) { return tr(this.o.characters[npcId].greeting, lang); }

  // ---------- Dashboard critic ----------
  async critic(teamId: string, spec: DashboardSpec, lang: Lang): Promise<{ findings: { id: string; severity: string; aspect: string; text: string }[]; source: Source }> {
    const rules = evaluateDashboard(spec).map((f: Finding) => ({ id: f.id, severity: f.severity, aspect: f.aspect, text: f.text[lang] }));
    this.e.chargeAi(teamId, "critic");
    let findings = rules;
    let source: Source = "scripted";
    if (this.liveOk(teamId)) {
      const sys = fill(this.o.prompts.critic, { lang: lang === "gl" ? "gallego" : "español", ruleFindings: JSON.stringify(rules.map((r) => r.id)) });
      const F = z.object({ id: z.string(), severity: z.enum(["info", "warn", "critical"]), aspect: z.enum(["clarity", "honesty", "accessibility"]), text: z.string().max(400) });
      const out = await this.llm(teamId, "fast", sys, JSON.stringify(spec).slice(0, 3000), z.object({ findings: z.array(F).min(1).max(8) }), 600);
      if (out) {
        // rule-based findings are authoritative and always shown; model adds extra, deduplicated by id
        const extra = out.findings.filter((f) => !rules.some((r) => r.id === f.id)).slice(0, 3).map((f) => ({ ...f, severity: "info" as const, text: scrubOutput(f.text) })); // only the rules can block (red) or cost confidence (yellow)
        findings = [...rules, ...extra];
        source = "live";
      }
    }
    return { findings, source };
  }

  // ---------- Ada (SQL helper, costs credits, always "unverified") ----------
  async ada(teamId: string, request: string, lang: Lang): Promise<{ sql?: string; explanation: string; confidence: number; assumptions: string[]; verified: false; source: Source; creditsLeft: number }> {
    const c = this.e.aiContext(teamId);
    const credits = () => this.e.aiContext(teamId).credits;
    const bad = inputProblem(request);
    if (bad) return { explanation: m(bad === "injection" ? "injection" : bad, lang), confidence: 0, assumptions: [], verified: false, source: "scripted", creditsLeft: credits() };
    if (!this.e.spendCredit(teamId)) return { explanation: m("no_credits", lang), confidence: 0, assumptions: [], verified: false, source: "scripted", creditsLeft: 0 };
    this.e.logAi(teamId, "ada", c.lock?.id ?? null, "user", request);
    const schemaDesc = "raw.patients(patient_id, ssn, first_name, last_name, birthdate, ...), raw.encounters(encounter_id, patient_id, organization_id, start_ts, stop_ts, encounter_class, loaded_at, source_file) — todo VARCHAR; marts.fct_admission(episode_id, patient_key, organization_id, admit_ts, discharge_ts, is_readmission_30d)";
    let res: { sql?: string; explanation: string; confidence: number; assumptions: string[] } | null = null;
    let source: Source = "scripted";
    if (this.liveOk(teamId)) {
      const out = await this.llm(teamId, "smart", fill(this.o.prompts.ada, { lang: lang === "gl" ? "gallego" : "español", schema: schemaDesc }), `<jugador>${request}</jugador>`, z.object({ sql: z.string().optional(), explanation: z.string().max(700), confidence: z.number().min(0).max(1), assumptions: z.array(z.string()).max(6).default([]) }), 500);
      if (out && (!out.sql || guardSql(out.sql).ok)) { res = { ...out, explanation: scrubOutput(out.explanation) }; source = "live"; }
    }
    if (!res) {
      const r = request.toLowerCase();
      if (/reingres|readmi/.test(r)) res = { sql: "select count(*) from marts.fct_admission where is_readmission_30d", explanation: lang === "gl" ? "Conto os episodios marcados como reingreso a 30 días." : "Cuento los episodios marcados como reingreso a 30 días.", confidence: 0.6, assumptions: [lang === "gl" ? "Supoño que o modelo fct_admission xa está feito." : "Supongo que el modelo fct_admission ya está hecho."] };
      else if (/paciente|ssn/.test(r)) res = { sql: "select count(distinct ssn) from raw.patients", explanation: lang === "gl" ? "Conto SSN distintos." : "Cuento SSN distintos.", confidence: 0.7, assumptions: [] };
      else res = { explanation: lang === "gl" ? "Non teño claro que táboa ou columna queres usar. Dime que queres contar e sobre que datos." : "No tengo claro qué tabla o columna quieres usar. Dime qué quieres contar y sobre qué datos.", confidence: 0.2, assumptions: [] };
    }
    this.e.logAi(teamId, "ada", c.lock?.id ?? null, "assistant", res.sql ?? res.explanation);
    return { ...res, verified: false, source, creditsLeft: credits() };
  }
}
