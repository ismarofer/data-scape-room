import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { codeCandidates, itemizeReport, simulateWeeks, train, ML_FEATURES, LEAK_FEATURES, tr, type HelpStatus, type Lang, type LockT, type MlFeature, type MlRow, type TrainResult, type LockStateView, type Meters, type TeamState } from "@codigo-alta/shared";
import { answerKey, type AnswerEntry, type Content } from "./content.js";
import { evalClaims, evalPrivacy, MSG, type Rubric } from "./validators.js";
import { chartTitle, evaluateDashboard, type DashboardSpec, type Finding } from "@codigo-alta/shared";
import { LOADER_TRUTH } from "./loader-truth.js";

export class GameError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}
export interface EngineOpts {
  content: Content;
  answers: Record<string, AnswerEntry>;
  salt: string;
  now?: () => number;
  hintGate?: boolean;
  rubrics?: Record<string, Rubric>;
  claimIds?: string[];
  mlRows?: MlRow[]; // R6 «Laboratorio de riesgo» dataset (server re-checks what a team submits)
  /** plain answer values (data/dist/answers.json, server only): fill "{answer}" in a lock's solution text for Lumi */
  answerValues?: Record<string, unknown>;
  /** correct option of each model piece (content/models/*.slots.yaml, server only): lets Lumi say which piece of R3C is wrong */
  slotKey?: Record<string, Record<string, string>>;
  onChange?: (teamId: string, type: string, payload?: unknown) => void;
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const rid = () => crypto.randomBytes(8).toString("hex");

/** What a submission (or a draft the team is still building) gets from the validator. Pure: no score, meters or attempts change. */
export interface EvalResult {
  ok: boolean; feedback?: string; findings?: Finding[]; badColumns?: { col: string; kind: string }[]; badItems?: { id: string }[]; missingCount?: number;
  privacyCritical?: boolean; falsePositives?: number;
}

export class Engine {
  now: () => number;
  get content() { return this.o.content; }
  private mlCache = new Map<string, TrainResult>();
  constructor(public db: DatabaseSync, private o: EngineOpts) {
    this.now = o.now ?? Date.now;
    // the browser rebuilds raw.* after a reload from the saved loader options: once the inbox is passed they must be the
    // right ones (teams that loaded the files before the formats changed on 26-nov kept options that now read them wrong)
    for (const r of db.prepare("SELECT team_id FROM lock_progress WHERE lock_id='r1a_bandeja' AND status='done'").all() as any[]) this.saveLoaderTruth(r.team_id);
  }
  private saveLoaderTruth(teamId: string) {
    this.db.prepare("INSERT INTO team_kv(team_id,k,v,ts) VALUES(?,'wiz',?,?) ON CONFLICT(team_id,k) DO UPDATE SET v=excluded.v, ts=excluded.ts").run(teamId, JSON.stringify(LOADER_TRUTH), this.now());
  }

  private log(teamId: string, type: string, payload: unknown = {}) {
    this.db.prepare("INSERT INTO events_log(team_id,type,payload_json,ts) VALUES(?,?,?,?)").run(teamId, type, JSON.stringify(payload), this.now());
  }
  private notify(teamId: string, type: string, payload?: unknown) {
    this.o.onChange?.(teamId, type, payload);
  }
  private hash(key: string, normalized: string) {
    return crypto.createHash("sha256").update(`${this.o.salt}:${key}:${normalized}`).digest("hex");
  }

  // ---------- sessions & teams ----------
  /** The game has one implicit session (nobody types a code). It is created the first time it is needed. */
  createSession() {
    const ex = this.db.prepare("SELECT id, code FROM sessions ORDER BY rowid LIMIT 1").get() as any;
    if (ex) return { id: ex.id as string, code: ex.code as string };
    const id = rid();
    this.db.prepare("INSERT INTO sessions(id,code,started_at,paused_at,config_json) VALUES(?,?,?,NULL,?)").run(id, "MAIN", this.now(), JSON.stringify(this.o.content.session));
    return { id, code: "MAIN" };
  }

  private blockedAlias(a: string) {
    const l = a.toLowerCase();
    return this.o.content.blocked.some((b) => l.includes(b));
  }

  /** Opens (or resumes) the team. Any number of laptops can join the same team: the state is shared. */
  join(req: { teamAlias: string }) {
    const s = this.createSession();
    if (this.blockedAlias(req.teamAlias)) throw new GameError(400, "alias_blocked", "Ese nombre no está permitido. Prueba con otro.");
    let team = this.db.prepare("SELECT * FROM teams WHERE session_id=? AND alias=?").get(s.id, req.teamAlias) as any;
    if (!team) {
      const id = rid();
      const meters: Meters = { ...this.o.content.session.meters_start, ai_credits: this.o.content.session.ai_credits };
      this.db
        .prepare("INSERT INTO teams(id,session_id,alias,created_at,meters_json,score,state_json) VALUES(?,?,?,?,?,0,?)")
        .run(id, s.id, req.teamAlias, this.now(), JSON.stringify(meters), JSON.stringify({ lang: "es" }));
      team = this.db.prepare("SELECT * FROM teams WHERE id=?").get(id);
      this.ensureLockProgress(id);
      this.log(id, "team_created", { alias: req.teamAlias });
    }
    this.syncLocks(team.id as string); // teams created before the levels changed (R6, the Commission, the old R2) are brought up to date
    return { teamId: team.id as string };
  }

  /** Small shared key/value store for tool state (loader options, model choices, dashboard) so any laptop can resume the work. */
  /** Plain value of a canonical answer (server only), e.g. for the Commission's summary cards. */
  answerValue(key: string): unknown { return this.o.answerValues?.[key]; }
  kvGet(teamId: string, key: string): string | null {
    const r = this.db.prepare("SELECT v FROM team_kv WHERE team_id=? AND k=?").get(teamId, key) as any;
    return r?.v ?? null;
  }
  kvSet(teamId: string, key: string, value: string) {
    if (!/^[a-z0-9_]{1,40}$/.test(key) || value.length > 60_000) throw new GameError(400, "bad_kv", "Clave o valor no válidos");
    this.team(teamId);
    this.db.prepare("INSERT INTO team_kv(team_id,k,v,ts) VALUES(?,?,?,?) ON CONFLICT(team_id,k) DO UPDATE SET v=excluded.v, ts=excluded.ts").run(teamId, key, value, this.now());
    this.notify(teamId, "kv_update", { key });
  }

  private team(teamId: string) {
    const t = this.db
      .prepare("SELECT t.*, s.paused_at FROM teams t JOIN sessions s ON s.id=t.session_id WHERE t.id=?")
      .get(teamId) as any;
    if (!t) throw new GameError(404, "no_team", "Equipo no encontrado");
    return t;
  }
  /** Keeps a team's levels in step with the content: adds new levels and drops ones that were removed (e.g. the old R2 staging levels). */
  private syncLocks(teamId: string) {
    const valid = new Set(this.o.content.order);
    const rows = this.db.prepare("SELECT lock_id FROM lock_progress WHERE team_id=?").all(teamId) as any[];
    const stale = rows.filter((r) => !valid.has(r.lock_id));
    if (!stale.length && rows.length === valid.size) return;
    for (const r of stale) this.db.prepare("DELETE FROM lock_progress WHERE team_id=? AND lock_id=?").run(teamId, r.lock_id);
    this.ensureLockProgress(teamId);
  }
  private ensureLockProgress(teamId: string) {
    for (const id of this.o.content.order) {
      this.db.prepare("INSERT OR IGNORE INTO lock_progress(team_id,lock_id,status) VALUES(?,?,'locked')").run(teamId, id);
    }
    this.openNext(teamId);
  }
  private openNext(teamId: string) {
    const rows = this.db.prepare("SELECT lock_id,status FROM lock_progress WHERE team_id=? ORDER BY rowid").all(teamId) as any[];
    if (rows.some((r) => r.status === "open")) return;
    const next = rows.find((r) => r.status === "locked");
    if (next) this.db.prepare("UPDATE lock_progress SET status='open', started_at=? WHERE team_id=? AND lock_id=?").run(this.now(), teamId, next.lock_id);
  }
  private currentLock(teamId: string) {
    const r = this.db.prepare("SELECT * FROM lock_progress WHERE team_id=? AND status='open'").get(teamId) as any;
    if (!r) throw new GameError(409, "no_open_lock", "No hay ningún candado abierto");
    return { prog: r, lock: this.o.content.locks.get(r.lock_id)! };
  }
  private decided(teamId: string, decisionId: string) {
    return this.db.prepare("SELECT choice FROM decision_ledger WHERE team_id=? AND decision_id=?").get(teamId, decisionId) as any;
  }
  private meters(teamId: string): Meters {
    return JSON.parse(this.team(teamId).meters_json);
  }
  private setMeters(teamId: string, m: Meters) {
    this.db.prepare("UPDATE teams SET meters_json=? WHERE id=?").run(JSON.stringify(m), teamId);
    this.db.prepare("INSERT INTO meter_history(team_id,ts,meters_json) VALUES(?,?,?)").run(teamId, this.now(), JSON.stringify(m));
  }
  /**
   * The game has ONE meter: the Commission's confidence (0-100, stored as meters.trust). Solving levels, good decisions
   * and badges raise it; help from Lumi, false marks, risky decisions and the master key lower it. There are no points.
   */
  private addScore(teamId: string, d: number) {
    if (!d) return;
    const m = this.meters(teamId);
    this.setMeters(teamId, { ...m, trust: clamp(m.trust + d) });
  }
  /** How much a solved level raises the confidence (levels are worth 90-160 «weight» in the content → +2…+4). */
  private reward(points: number) { return points > 0 ? Math.max(1, Math.round(points / 40)) : 0; }

  // ---------- state view (never contains answers) ----------
  state(teamId: string, lang: Lang = "es"): TeamState {
    const t = this.team(teamId);
    this.syncLocks(teamId);
    const rows = this.db.prepare("SELECT * FROM lock_progress WHERE team_id=? ORDER BY rowid").all(teamId) as any[];
    const delivered = this.delivered(teamId), led = this.ledger(teamId);
    const locks: LockStateView[] = rows.map((r) => {
      const l = this.o.content.locks.get(r.lock_id)!;
      const open = r.status === "open";
      const showText = open || r.status === "done";
      const dec =
        l.decision && open && !this.decided(teamId, l.decision.id)
          ? { id: l.decision.id, options: l.decision.options.map((o) => ({ id: o.id, label: tr(o.label, lang), explain: o.explain ? tr(o.explain, lang) : undefined })) }
          : undefined;
      const g = this.o.content.guides.locks[l.id];
      const usedHints = Math.min(3, r.hints_used);
      const rg = this.o.content.guides.rooms[l.room];
      const room = this.o.content.rooms.get(l.room);
      const guide = showText && g
        ? { goal: tr(g.goal, lang), steps: g.steps.map((x) => tr(x, lang)), why: tr(g.why, lang), job: g.job ? tr(g.job, lang) : undefined,
            terms: g.terms.filter((k) => this.o.content.glossary[k]).map((k) => ({ term: tr(this.o.content.glossary[k].term, lang), def: tr(this.o.content.glossary[k].def, lang) })) }
        : undefined;
      const roomInfo = showText && room && rg ? { id: room.id, title: tr(room.title, lang), context: tr(rg.context, lang), learn: tr(rg.learn, lang), first: room.locks[0] === l.id } : undefined;
      return {
        guide, roomInfo,
        id: l.id, room: l.room, type: l.type, title: tr(l.title, lang), story: showText ? tr(l.story, lang) : "", points: l.points, status: r.status,
        attempts: r.attempts, hintsUsed: r.hints_used, hints: showText ? l.hints.slice(0, usedHints).map((h) => tr(h, lang)) : [], decision: dec,
        solution: showText && r.hints_used >= 4 ? this.solutionText(l, lang) : undefined, help: open ? this.helpStatus(r, l) : undefined,
        docs: showText ? l.docs_needed.flatMap((id) => { const d = this.o.content.docs.find((x) => x.id === id); return d ? [{ path: d.path, title: tr(d.title, lang) }] : []; }) : [],
        answerHint: showText && l.answer_hint ? tr(l.answer_hint, lang) : undefined, timeTargetMin: l.time_target_min, tools: open ? l.tools : [], startedAt: r.started_at ?? undefined,
        hintAvailableAt: undefined,
        mine: r.status === "done" ? (() => {
          const d = l.decision ? led.find((x) => x.lock_id === l.id) : undefined;
          const o = d && l.decision!.options.find((x) => x.id === d.choice);
          return { code: delivered.get(l.id), decision: o ? tr(o.label, lang) : undefined, options: d && l.decision ? l.decision.options.map((x) => ({ label: tr(x.label, lang), explain: x.explain ? tr(x.explain, lang) : undefined, chosen: x.id === d.choice })) : undefined };
        })() : undefined,
      };
    });
    // A project document appears in the explorer once the first level that relies on it has been reached.
    const reached = new Set(rows.filter((r) => r.status !== "locked").map((r) => r.lock_id as string));
    const docs = this.o.content.docs.flatMap((d) => {
      const first = this.o.content.order.find((id) => this.o.content.locks.get(id)?.docs_needed.includes(d.id));
      return first && reached.has(first) ? [{ id: d.id, path: d.path, title: tr(d.title, lang), body: tr(d.body, lang) }] : [];
    });
    return {
      teamId, alias: t.alias, lang, score: JSON.parse(t.meters_json).trust, meters: JSON.parse(t.meters_json),
      clues: [...this.clues(teamId)], aiCost: this.o.content.session.ai_use_penalty, startedAt: t.created_at, pausedAt: t.paused_at, currentLockId: rows.find((r) => r.status === "open")?.lock_id ?? null, locks,
      rooms: this.o.content.session.rooms.flatMap((id) => {
        const r = this.o.content.rooms.get(id);
        if (!r) return [];
        const rg = this.o.content.guides.rooms[id];
        return [{ id, title: tr(r.title, lang), number: r.number, stage: r.stage ? tr(r.stage, lang) : undefined, icon: r.icon, intro: tr(r.intro, lang), context: rg ? tr(rg.context, lang) : undefined, learn: rg ? tr(rg.learn, lang) : undefined, primer: rg?.primer ? { title: tr(rg.primer.title, lang), body: tr(rg.primer.body, lang) } : undefined, briefing: r.briefing.map((b) => tr(b, lang)), targetMinutes: r.target_minutes }];
      }), docs, glossary: Object.values(this.o.content.glossary).map((g) => ({ term: tr(g.term, lang), def: tr(g.def, lang) })).sort((a, b) => a.term.localeCompare(b.term, lang)), serverNow: this.now(),
    };
  }

  // ---------- actions ----------
  decide(teamId: string, lockId: string, optionId: string) {
    const { lock } = this.currentLock(teamId);
    if (lock.id !== lockId || !lock.decision) throw new GameError(400, "no_decision", "Este candado no tiene decisión pendiente");
    if (this.decided(teamId, lock.decision.id)) throw new GameError(409, "already_decided", "La decisión ya está tomada");
    const opt = lock.decision.options.find((o) => o.id === optionId);
    if (!opt) throw new GameError(400, "bad_option", "Opción no válida");
    const e = opt.effects ?? {};
    // the old three effects (quality, trust, compliance) collapse into the single confidence meter
    this.addScore(teamId, Math.round(((e.quality ?? 0) + (e.trust ?? 0) + (e.compliance ?? 0)) / 3) + this.reward(e.points ?? 0));
    this.db
      .prepare("INSERT INTO decision_ledger(team_id,lock_id,decision_id,choice,effects_json,ts) VALUES(?,?,?,?,?,?)")
      .run(teamId, lock.id, lock.decision.id, opt.id, JSON.stringify({ ...e, tag: opt.ledger_tag }), this.now());
    this.log(teamId, "decision", { lock: lock.id, option: opt.id });
    this.notify(teamId, "state_update");
    return { tag: opt.ledger_tag };
  }

  /** Runs the validator of a lock on a report or code. Never changes the game: submit() applies the consequences. */
  evaluate(lock: LockT, code: string, lang: Lang = "es"): EvalResult {
    const v = lock.validator;
    if (v?.type === "privacy_rubric") {
      const rubric = this.o.rubrics?.[v.rubric];
      if (!rubric) throw new GameError(500, "no_rubric", "Candado sin rúbrica");
      const r = evalPrivacy(code, rubric);
      if (r.ok) return { ok: true };
      // which columns are wrong (never says which treatment is right)
      return { ok: false, badColumns: r.bad, privacyCritical: r.critical > 0, feedback: MSG[r.missing ? "privacy_missing" : r.critical ? "privacy_critical" : r.blocking ? "privacy_blocking" : "privacy_warn"][lang] };
    }
    if (v?.type === "chart_rules") {
      let spec: DashboardSpec | null = null;
      try { spec = JSON.parse(code); } catch { /* invalid */ }
      if (!spec || !Array.isArray(spec.charts)) throw new GameError(400, "bad_spec", "Dashboard no válido");
      const findings = evaluateDashboard(spec);
      if (v.mode === "build") {
        const ok = spec.charts.length >= 3 && spec.charts.length <= 4;
        return { ok, findings, feedback: ok ? undefined : MSG.dash_structure[lang] };
      }
      // red (critical) findings block; yellow ones let the team go on with less confidence gained
      const ok = !findings.some((f) => f.severity === "critical");
      return { ok, findings, feedback: ok ? undefined : MSG.dash_findings[lang] };
    }
    if (v?.type === "ml_train" || v?.type === "ml_threshold" || v?.type === "ml_equity") return this.mlCheck(v, code, lang);
    if (v?.type === "commission") throw new GameError(400, "not_code", "La Comisión se responde hablando, no con código");
    if (v?.type === "interview") return { ok: true }; // submit() decides the reward from the clues found
    if (v?.type === "verify_claims") {
      const exp = this.o.answers[v.answer_key];
      if (!exp) throw new GameError(500, "no_answer", "Candado sin respuesta configurada");
      const r = evalClaims(code, this.o.claimIds ?? [], (n) => this.hash(v.answer_key, n), exp.sha256_salted);
      if (r.ok) return { ok: true };
      return { ok: false, feedback: MSG[r.falsePositives ? "claims_fp" : "claims_fn"][lang], falsePositives: r.falsePositives, badItems: r.wrongMarks.map((id) => ({ id })), missingCount: r.falseNegatives };
    }
    if (!lock.answer) throw new GameError(400, "not_code", "Este candado no se abre con código");
    const key = answerKey(lock.answer.source);
    const ans = this.o.answers[key];
    if (!ans) throw new GameError(500, "no_answer", "Candado sin respuesta configurada");
    for (const r of lock.numeric_ranges) {
      // e.g. «min_n=25»: inside [min, max] it counts as the canonical option, outside it is simply wrong
      code = code.replace(new RegExp(`(^|;)${r.field}=([^;]*)`), (m, pre, v) => { if (!/^\d+(\.\d+)?$/.test(v.trim())) return m; const n = Number(v); return `${pre}${r.field}=${n >= r.min && n <= r.max ? r.canonical : `out_of_range_${v.trim()}`}`; });
    }
    const ok = codeCandidates(code, lock.answer.normalize).some((c) => {
      const h = this.hash(key, c);
      return h === ans.sha256_salted || ans.aliases.includes(h);
    });
    if (ok) return { ok: true };
    const out: EvalResult = { ok: false, feedback: MSG.wrong_code[lang] };
    if (lock.answer.normalize === "report" && ans.items) {
      // tell WHICH items are wrong (never the right values): each submitted item is checked against the salted hashes of the correct ones
      const sent = itemizeReport(key, code);
      out.badItems = sent.filter((it) => !ans.items!.includes(this.hash(key, `item:${it.value}`))).map((it) => ({ id: it.id }));
      out.missingCount = Math.max(0, ans.items.length - sent.length); // items not submitted at all (e.g. missing joins)
    }
    return out;
  }

  submit(teamId: string, code: string, lang: Lang = "es"): { ok: boolean; feedback?: string; findings?: Finding[]; badColumns?: { col: string; kind: string }[]; badItems?: { id: string }[]; missingCount?: number } {
    const t = this.team(teamId);
    if (t.paused_at) throw new GameError(409, "paused", "El juego está en pausa");
    const { lock } = this.currentLock(teamId);
    if (lock.decision && !this.decided(teamId, lock.decision.id)) throw new GameError(409, "decide_first", "Primero toma la decisión de este candado");
    const r = this.evaluate(lock, code, lang);
    if (r.privacyCritical) {
      const first = !this.db.prepare("SELECT 1 FROM events_log WHERE team_id=? AND type='privacy_critical'").get(teamId);
      this.log(teamId, "privacy_critical", { lock: lock.id });
      this.addScore(teamId, first ? -6 : -2);
    }
    if (r.falsePositives && lock.validator?.type === "verify_claims") this.addScore(teamId, -lock.validator.false_positive_penalty * r.falsePositives);
    if (lock.validator?.type === "chart_rules") this.log(teamId, "dashboard_review", { lock: lock.id, findings: (r.findings ?? []).map((x) => x.id) });
    this.db.prepare("UPDATE lock_progress SET attempts=attempts+1 WHERE team_id=? AND lock_id=?").run(teamId, lock.id);
    // what was tried is kept (short) so Lumi can talk about the last attempts
    const bad = [...(r.badItems ?? []).map((b) => b.id), ...(r.badColumns ?? []).map((b) => b.col), ...(lock.validator?.type === "chart_rules" ? (r.findings ?? []).map((f) => f.id) : [])];
    this.log(teamId, "submit", { lock: lock.id, ok: r.ok, code: lock.validator?.type === "chart_rules" ? "(dashboard)" : code.slice(0, 300), bad: bad.slice(0, 20), missing: r.missingCount ?? 0 });
    if (r.ok && lock.type === "decision" && !lock.decision) this.db.prepare("INSERT INTO decision_ledger(team_id,lock_id,decision_id,choice,effects_json,ts) VALUES(?,?,?,?,?,?)").run(teamId, lock.id, lock.id, code.slice(0, 300), "{}", this.now());
    if (!r.ok) {
      this.notify(teamId, "state_update");
      return { ok: false, feedback: r.feedback, findings: r.findings, badColumns: r.badColumns, badItems: r.badItems, missingCount: r.missingCount };
    }
    let points = lock.points;
    if (lock.validator?.type === "interview") {
      const got = lock.validator.clues.filter((c) => this.clues(teamId).has(c)).length;
      points = Math.round(lock.points * (0.25 + 0.25 * got)); // 0 clues still lets you go on, each clue is worth more confidence
    }
    if (lock.validator?.type === "chart_rules" && lock.validator.mode === "review") {
      const warns = (r.findings ?? []).filter((f) => f.severity === "warn").length;
      points = Math.round(lock.points * Math.max(0.4, 1 - 0.15 * warns)); // yellow lets you continue, but each one costs
    }
    this.log(teamId, "solved", { lock: lock.id, code: code.slice(0, 20_000) }); // whole accepted answer: the solved level shows it read-only
    this.complete(teamId, lock.id, points, false);
    return { ok: true, findings: r.findings };
  }

  /** Checks what the team is building right now (not submitted yet) so Lumi knows what is right and wrong. null = nothing to check. */
  diagnose(teamId: string, draft: string, lang: Lang = "es"): { lockId: string; ok: boolean; wrong: string[]; missing: number; note?: string } | null {
    const cur = this.db.prepare("SELECT lock_id FROM lock_progress WHERE team_id=? AND status='open'").get(teamId) as any;
    const lock = cur ? this.o.content.locks.get(cur.lock_id) : undefined;
    const d = draft.trim();
    if (!lock || !d) return null;
    if (d.startsWith("slots:")) {
      // R3C model pieces: "slots:model.slot=id,model.slot=id"
      const key = this.o.slotKey;
      if (!key) return null;
      const given = new Map(d.slice(6).split(",").filter(Boolean).map((p) => p.split("=") as [string, string]));
      const wrong: string[] = [];
      let missing = 0;
      for (const [model, slots] of Object.entries(key)) {
        if (![...given.keys()].some((k) => k.startsWith(model + "."))) continue; // a model the level does not use
        for (const [slot, ok] of Object.entries(slots)) {
          const g = given.get(`${model}.${slot}`);
          if (!g) missing++;
          else if (g !== ok) wrong.push(`${model}.${slot}`);
        }
      }
      return { lockId: lock.id, ok: wrong.length === 0 && missing === 0, wrong, missing };
    }
    try {
      const r = this.evaluate(lock, d, lang);
      return { lockId: lock.id, ok: r.ok, wrong: [...(r.badItems ?? []).map((b) => b.id), ...(r.badColumns ?? []).map((b) => `${b.col} (${b.kind})`), ...(r.findings ?? []).map((f) => f.id)], missing: r.missingCount ?? 0, note: r.ok ? undefined : r.feedback };
    } catch { return null; }
  }

  /** The last tries the team submitted on a level (newest first), for Lumi. */
  lastAttempts(teamId: string, lockId: string, n = 3): { ok: boolean; code: string; bad: string[]; missing: number }[] {
    const rows = this.db.prepare("SELECT payload_json FROM events_log WHERE team_id=? AND type='submit' ORDER BY id DESC LIMIT 80").all(teamId) as any[];
    const out: { ok: boolean; code: string; bad: string[]; missing: number }[] = [];
    for (const r of rows) {
      try { const p = JSON.parse(r.payload_json); if (p.lock === lockId) out.push({ ok: !!p.ok, code: String(p.code ?? ""), bad: p.bad ?? [], missing: Number(p.missing ?? 0) }); } catch { /* ignore */ }
      if (out.length >= n) break;
    }
    return out;
  }

  // ---------- R6 «Laboratorio de riesgo» ----------
  private mlTrain(feats: MlFeature[]): TrainResult {
    const key = [...feats].sort().join(",");
    let r = this.mlCache.get(key);
    if (!r) { r = train(this.o.mlRows!, [...feats].sort() as MlFeature[]); this.mlCache.set(key, r); }
    return r;
  }
  private mlCheck(v: any, code: string, lang: Lang): EvalResult {
    if (!this.o.mlRows) throw new GameError(500, "no_ml", "Laboratorio no disponible");
    const fail = (k: string, extra = "") => ({ ok: false, feedback: MSG[k][lang] + extra });
    if (v.type === "ml_equity") {
      const m = /^decision=([a-z_]+);text=([\s\S]*)$/.exec(code.trim());
      if (!m || !["deploy", "deploy_review", "no_deploy"].includes(m[1])) return fail("ml_bad");
      const text = m[2].trim();
      if (text.length < v.min_chars) return fail("ml_eq_short");
      if (m[1] === "deploy") return fail("ml_eq_deploy");
      if (m[1] === "no_deploy") return fail("ml_eq_nodeploy");
      const t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const groups = /(sexo|mujer|hombre|edad|grupo|tramo|joven|mayor)/.test(t), review = /(revis|human|supervis|persona|control|profesional)/.test(t);
      return groups && review ? { ok: true } : fail("ml_eq_text");
    }
    const kv = Object.fromEntries(code.split(";").map((p) => { const i = p.indexOf("="); return [p.slice(0, i), p.slice(i + 1)]; }));
    const feats = (kv.features ?? "").split(",").filter(Boolean) as MlFeature[];
    if (!feats.length || feats.some((f) => !ML_FEATURES.includes(f))) return fail("ml_bad");
    if (feats.some((f) => LEAK_FEATURES.includes(f))) return fail("ml_leak");
    if (feats.length < (v.min_features ?? 2)) return fail("ml_few");
    const tr_ = this.mlTrain(feats);
    if (v.type === "ml_train") return tr_.auc >= v.min_auc ? { ok: true } : fail("ml_weak");
    const t = Number(kv.threshold);
    if (!(t > 0 && t < 1)) return fail("ml_bad");
    if (tr_.auc < 0.65) return fail("ml_weak");
    const sim = simulateWeeks(tr_.probs, tr_.y, t);
    if (sim.callsPerWeek > v.capacity) {
      const msg = lang === "gl" ? `Con ese limiar a enfermaría recibiría ${Math.round(sim.callsPerWeek)} chamadas por semana (máximo ${v.capacity}).` : `Con ese umbral la enfermería recibiría unas ${Math.round(sim.callsPerWeek)} llamadas por semana (máximo ${v.capacity}).`;
      return { ok: false, feedback: msg };
    }
    if (sim.sensitivity < v.min_sensitivity) return fail("ml_miss");
    return { ok: true };
  }
  /** The bonus room is optional: a team can skip it and go straight to the Commission. */
  skipBonus(teamId: string) {
    const { lock } = this.currentLock(teamId);
    if (lock.room !== "R6") throw new GameError(400, "not_bonus", "Solo se puede saltar la sala bonus");
    const r6 = [...this.o.content.locks.values()].filter((l) => l.room === "R6").map((l) => l.id);
    for (const id of r6) this.db.prepare("UPDATE lock_progress SET status='done', completed_at=?, points=0 WHERE team_id=? AND lock_id=? AND status<>'done'").run(this.now(), teamId, id);
    this.log(teamId, "r6_skipped", {});
    this.openNext(teamId);
    this.notify(teamId, "state_update");
  }
  notifyTeam(teamId: string) { this.notify(teamId, "state_update"); }
  logEvent(teamId: string, type: string, payload: unknown) { this.log(teamId, type, payload); }
  finishLock(teamId: string, lockId: string, points: number) { this.complete(teamId, lockId, points, false); }
  addPoints(teamId: string, d: number) { this.addScore(teamId, d); }
  /** lock_id -> progress (status, attempts, hints used, points, master key) */
  progress(teamId: string): Record<string, { status: string; attempts: number; hints: number; points: number; master: boolean }> {
    const rows = this.db.prepare("SELECT * FROM lock_progress WHERE team_id=?").all(teamId) as any[];
    return Object.fromEntries(rows.map((r) => [r.lock_id, { status: r.status, attempts: r.attempts, hints: r.hints_used, points: r.points, master: !!r.master_key_used }]));
  }
  /** The accepted answer of every level the team passed (older teams: the last correct attempt, kept short). */
  private delivered(teamId: string): Map<string, string> {
    const out = new Map<string, string>();
    for (const e of this.db.prepare("SELECT type, payload_json FROM events_log WHERE team_id=? AND type IN ('submit','solved') ORDER BY id").all(teamId) as any[]) {
      try { const p = JSON.parse(e.payload_json); if (e.type === "solved" || (p.ok && p.code !== "(dashboard)" && !out.has(p.lock))) out.set(p.lock, String(p.code)); } catch { /* ignore */ }
    }
    return out;
  }
  ledger(teamId: string): { lock_id: string; choice: string; tag?: string }[] {
    return (this.db.prepare("SELECT lock_id, choice, effects_json FROM decision_ledger WHERE team_id=? ORDER BY id").all(teamId) as any[]).map((r) => { let tag: string | undefined; try { tag = JSON.parse(r.effects_json).tag; } catch { /* ignore */ } return { lock_id: r.lock_id, choice: r.choice, tag }; });
  }
  eventCount(teamId: string, type: string): number {
    return Number((this.db.prepare("SELECT COUNT(*) AS n FROM events_log WHERE team_id=? AND type=?").get(teamId, type) as any).n);
  }
  meterValues(teamId: string): Meters { return this.meters(teamId); }
  teamScore(teamId: string): number { return this.meters(teamId).trust; }
  teamAlias(teamId: string): string { return String(this.team(teamId).alias); }

  // ---------- facilitator ----------
  teamDetail(teamId: string) {
    const t = this.team(teamId);
    return {
      teamId, alias: t.alias, score: JSON.parse(t.meters_json).trust, meters: JSON.parse(t.meters_json), progress: this.progress(teamId), ledger: this.ledger(teamId),
      events: (this.db.prepare("SELECT type, payload_json, ts FROM events_log WHERE team_id=? ORDER BY id DESC LIMIT 60").all(teamId) as any[]).map((e) => ({ type: e.type, payload: e.payload_json, ts: e.ts })),
      ai: (this.db.prepare("SELECT character, lock_id, role, text, ts FROM ai_messages WHERE team_id=? AND character<>'_usage' ORDER BY id DESC LIMIT 120").all(teamId) as any[]).reverse(),
    };
  }
  exportAll() {
    const teams = (this.db.prepare("SELECT id FROM teams").all() as any[]).map((t) => this.teamDetail(t.id));
    return { exportedAt: this.now(), teams, aiTokens: Number((this.db.prepare("SELECT COALESCE(SUM(tokens),0) AS n FROM ai_messages").get() as any).n) };
  }

  private complete(teamId: string, lockId: string, points: number, master: boolean) {
    this.db
      .prepare("UPDATE lock_progress SET status='done', completed_at=?, points=?, master_key_used=? WHERE team_id=? AND lock_id=?")
      .run(this.now(), points, master ? 1 : 0, teamId, lockId);
    this.addScore(teamId, this.reward(points));
    if (lockId === "r1a_bandeja") this.saveLoaderTruth(teamId); // passed: no answer left to give away, and the reload restore is always right
    this.openNext(teamId);
    this.notify(teamId, "state_update");
  }

  /** Lumi's help ladder for one level: levels 1-3 are the lock's hints, level 4 is the solution (if the lock has one). */
  private helpStatus(prog: any, lock: LockT): HelpStatus {
    const cfg = this.o.content.session;
    const max = lock.solution ? 4 : 3;
    const used = Math.min(prog.hints_used ?? 0, max);
    if (used >= max) return { used, max: 4, next: null };
    const level = used + 1;
    const fails = Number(prog.attempts ?? 0);
    const needAttempts = cfg.help_gate_attempts[level - 1];
    const waitMs = (prog.started_at ?? 0) + cfg.help_gate_minutes[level - 1] * 60_000 - this.now();
    const unlocked = !(this.o.hintGate ?? true) || fails >= needAttempts || waitMs <= 0;
    return {
      used, max: 4,
      next: { level, penalty: level <= 3 ? cfg.hint_penalty[level - 1] : cfg.solution_penalty, unlocked, waitSeconds: unlocked ? 0 : Math.max(0, Math.ceil(waitMs / 1000)), attemptsNeeded: unlocked ? 0 : Math.max(0, needAttempts - fails) },
    };
  }
  /** The full solution of a lock in plain words, with the real value where the text says "{answer}". Server only. */
  solutionText(lock: LockT, lang: Lang): string | undefined {
    if (!lock.solution) return undefined;
    const v = lock.answer ? this.o.answerValues?.[answerKey(lock.answer.source)] : undefined;
    return tr(lock.solution, lang).replace(/\{answer\}/g, v === undefined || v === null ? "?" : String(v));
  }
  helpText(lock: LockT, level: number, lang: Lang): string {
    return level >= 4 ? this.solutionText(lock, lang) ?? "" : tr(lock.hints[level - 1], lang);
  }

  /** Asks Lumi for the next step of help. Costs points; each step unlocks with failed tries or with time spent in the level. */
  hint(teamId: string, level: number, lang: Lang = "es") {
    this.team(teamId);
    const { prog, lock } = this.currentLock(teamId);
    if (level !== prog.hints_used + 1) throw new GameError(409, "hint_order", "Las ayudas se piden en orden: 1, 2, 3 y la solución");
    const st = this.helpStatus(prog, lock);
    if (!st.next || st.next.level !== level) throw new GameError(409, "hint_order", "No hay más ayudas para este nivel");
    if (!st.next.unlocked) throw new GameError(425, "hint_gate", "Aún es pronto para esa ayuda. ¡Seguid intentándolo!", { waitSeconds: st.next.waitSeconds, attemptsNeeded: st.next.attemptsNeeded });
    const penalty = st.next.penalty;
    this.db.prepare("UPDATE lock_progress SET hints_used=? WHERE team_id=? AND lock_id=?").run(level, teamId, lock.id);
    this.addScore(teamId, -penalty);
    this.log(teamId, "hint", { lock: lock.id, level });
    const text = this.helpText(lock, level, lang);
    this.notify(teamId, "hint_granted", { level });
    this.notify(teamId, "state_update");
    return { level, penalty, text, lockId: lock.id };
  }

  // ---------- AI support ----------
  aiContext(teamId: string) {
    const t = this.team(teamId);
    const cur = this.db.prepare("SELECT * FROM lock_progress WHERE team_id=? AND status='open'").get(teamId) as any;
    const lock = cur ? this.o.content.locks.get(cur.lock_id) : undefined;
    return {
      sessionId: t.session_id as string, lock, hintsUsed: (cur?.hints_used ?? 0) as number, credits: (JSON.parse(t.meters_json) as Meters).ai_credits,
      attempts: (cur?.attempts ?? 0) as number, minutesInLock: cur?.started_at ? Math.round((this.now() - cur.started_at) / 60000) : 0,
      help: cur && lock ? this.helpStatus(cur, lock) : undefined,
    };
  }
  /** A character's conversation as the players see it (oldest first), with the level each message belongs to. */
  chatLog(teamId: string, character: string, max = 40): { role: "user" | "assistant"; text: string; lockId: string | null }[] {
    this.team(teamId);
    const rows = this.db.prepare("SELECT role, text, lock_id FROM ai_messages WHERE team_id=? AND character=? ORDER BY id DESC LIMIT ?").all(teamId, character, max) as any[];
    return rows.reverse().filter((r) => !String(r.text).startsWith("[bloqueado")).map((r) => ({ role: r.role, text: String(r.text), lockId: r.lock_id ?? null }));
  }
  /** Last turns of a character's chat with this team (oldest first), blocked messages left out. */
  recentChat(teamId: string, character: string, max = 8): { role: "user" | "assistant"; text: string }[] {
    const rows = this.db.prepare("SELECT role, text FROM ai_messages WHERE team_id=? AND character=? ORDER BY id DESC LIMIT ?").all(teamId, character, max * 2) as any[];
    return rows.reverse().filter((r) => !String(r.text).startsWith("[bloqueado")).slice(-max).map((r) => ({ role: r.role as "user" | "assistant", text: String(r.text) }));
  }

  /** Plain-text summary of where the team is (progress, meters, decisions, what they have set up in the tools). Never contains answers. */
  snapshot(teamId: string, lang: Lang): string {
    const t = this.team(teamId);
    const L = (id: string) => this.o.content.locks.get(id)!;
    const rows = this.db.prepare("SELECT * FROM lock_progress WHERE team_id=? ORDER BY rowid").all(teamId) as any[];
    const done = rows.filter((r) => r.status === "done");
    const cur = rows.find((r) => r.status === "open");
    const m = JSON.parse(t.meters_json) as Meters;
    const out: string[] = [];
    out.push(`Progreso: ${done.length} de ${rows.length} niveles superados${done.length ? ` (${done.map((r) => tr(L(r.lock_id).title, lang)).join(", ")})` : ""}.`);
    if (cur) {
      const fails = (this.db.prepare("SELECT payload_json FROM events_log WHERE team_id=? AND type='submit'").all(teamId) as any[]).filter((e) => { try { const p = JSON.parse(e.payload_json); return p.lock === cur.lock_id && !p.ok; } catch { return false; } }).length;
      out.push(`Nivel actual: ${tr(L(cur.lock_id).title, lang)} · intentos fallidos al entregar: ${fails} · ayudas de Lumi pedidas: ${cur.hints_used}/${L(cur.lock_id).solution ? 4 : 3} · minutos en este nivel: ${cur.started_at ? Math.round((this.now() - cur.started_at) / 60000) : 0}.`);
    } else out.push("Han terminado todos los niveles.");
    out.push(`Confianza de la Comisión (único medidor, 0-100): ${m.trust}.`);
    const dec = (this.db.prepare("SELECT lock_id, choice FROM decision_ledger WHERE team_id=? ORDER BY id").all(teamId) as any[]).flatMap((d) => {
      const lk = this.o.content.locks.get(d.lock_id); const opt = lk?.decision?.options.find((o) => o.id === d.choice);
      return opt ? [`${tr(lk!.title, lang)}: «${tr(opt.label, lang)}»`] : [];
    });
    if (dec.length) out.push(`Decisiones tomadas: ${dec.join("; ")}.`);
    const kv: Record<string, any> = {};
    for (const r of this.db.prepare("SELECT k, v FROM team_kv WHERE team_id=?").all(teamId) as any[]) { try { kv[r.k] = JSON.parse(r.v); } catch { /* ignore */ } }
    if (kv.wiz && typeof kv.wiz === "object") {
      const f = Object.entries(kv.wiz as Record<string, any>).map(([n, o]) => `${n} (sep ${JSON.stringify(o.delimiter)}, ${o.encoding}, fecha ${o.dateFormat})`);
      if (f.length) out.push(`Cargador de ficheros, opciones elegidas: ${f.join("; ")}.`);
    }
    if (kv.mb && typeof kv.mb === "object") {
      const f = Object.entries(kv.mb as Record<string, any>).map(([n, o]) => `${n}: ${Object.entries(o ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") || "sin piezas"}`);
      if (f.length) out.push(`Constructor de modelos, piezas elegidas: ${f.join("; ")}.`);
    }
    if (kv.dash && Array.isArray(kv.dash.charts)) {
      out.push(`Dashboard: ${kv.dash.charts.length} gráfico(s)${kv.dash.charts.length ? ": " + kv.dash.charts.map((c: any) => { try { return chartTitle(c); } catch { return "?"; } }).join("; ") : ""}.`);
    }
    return out.join("\n");
  }

  logAi(teamId: string, character: string, lockId: string | null, role: "user" | "assistant", text: string, tokens = 0) {
    this.db.prepare("INSERT INTO ai_messages(team_id,character,lock_id,role,text,tokens,ts) VALUES(?,?,?,?,?,?,?)").run(teamId, character, lockId, role, text.slice(0, 2000), tokens, this.now());
  }
  aiTokensForSession(sessionId: string): number {
    return Number((this.db.prepare("SELECT COALESCE(SUM(m.tokens),0) AS n FROM ai_messages m JOIN teams t ON t.id=m.team_id WHERE t.session_id=?").get(sessionId) as any).n);
  }
  npcUserTurns(teamId: string, npcId: string): number {
    return Number((this.db.prepare("SELECT COUNT(*) AS n FROM ai_messages WHERE team_id=? AND character=? AND role='user'").get(teamId, npcId) as any).n);
  }
  clues(teamId: string): Set<string> {
    const rows = this.db.prepare("SELECT payload_json FROM events_log WHERE team_id=? AND type='clue'").all(teamId) as any[];
    return new Set(rows.map((r) => JSON.parse(r.payload_json).id as string));
  }
  addClues(teamId: string, ids: string[]) {
    const have = this.clues(teamId);
    for (const id of ids) if (!have.has(id)) this.log(teamId, "clue", { id });
    const cur = this.db.prepare("SELECT lock_id FROM lock_progress WHERE team_id=? AND status='open'").get(teamId) as any;
    const lock = cur ? this.o.content.locks.get(cur.lock_id) : undefined;
    // the interview level does not close by itself: the team reads the clue and decides when to go on
    this.notify(teamId, "state_update");
    return false;
  }
  /** Each use of an AI character lowers the confidence (session.ai_use_penalty; 0 = free). Returns what it cost. */
  chargeAi(teamId: string, who: "lumi" | "npc" | "critic"): number {
    const n = this.o.content.session.ai_use_penalty[who] ?? 0;
    if (n <= 0) return 0;
    this.addScore(teamId, -n);
    this.log(teamId, "ai_use", { who });
    this.notify(teamId, "state_update");
    return n;
  }
  spendCredit(teamId: string): boolean {
    const m = this.meters(teamId);
    if (m.ai_credits <= 0) return false;
    this.setMeters(teamId, { ...m, ai_credits: m.ai_credits - 1 });
    this.notify(teamId, "state_update");
    return true;
  }
  /** True when the text contains the lock's answer (any 1-3 consecutive tokens hash to it). Used to filter model output. */
  leaksAnswer(lockId: string, text: string): boolean {
    const lock = this.o.content.locks.get(lockId);
    if (!lock?.answer || lock.answer.normalize === "report") return false;
    const key = answerKey(lock.answer.source);
    const ans = this.o.answers[key];
    if (!ans) return false;
    const toks = text.match(/[\p{L}\p{N}]+/gu) ?? [];
    const cands = new Set<string>();
    for (let i = 0; i < toks.length; i++) {
      cands.add(toks[i]);
      if (i + 1 < toks.length) cands.add(toks[i] + toks[i + 1]);
      if (i + 2 < toks.length) cands.add(toks[i] + toks[i + 1] + toks[i + 2]);
    }
    for (const c of cands) for (const n of codeCandidates(c, lock.answer.normalize)) {
      const h = this.hash(key, n);
      if (h === ans.sha256_salted || ans.aliases.includes(h)) return true;
    }
    return false;
  }

  masterKey(teamId: string) {
    const { lock } = this.currentLock(teamId);
    this.complete(teamId, lock.id, 0, true);
    this.addScore(teamId, -this.o.content.session.master_key_penalty);
    this.log(teamId, "master_key", { lock: lock.id });
    return { lock: lock.id };
  }

  /**
   * Facilitator / testing shortcut: puts a team at the start of any level. Every level before it counts as solved
   * correctly (good decisions, correct loader options, a sensible KPI minimum) so the tools of the target level have
   * what they need; the target and everything after it start from zero (attempts, help, decisions, clues, saved tool state).
   * The confidence meter is not touched.
   */
  jumpTo(teamId: string, lockId: string) {
    this.team(teamId);
    const order = this.o.content.order;
    const idx = order.indexOf(lockId);
    if (idx < 0) throw new GameError(400, "bad_lock", "Ese nivel no existe");
    this.syncLocks(teamId);
    const now = this.now();
    const before = order.slice(0, idx), after = order.slice(idx);
    for (const id of before) {
      const l = this.o.content.locks.get(id)!;
      this.db.prepare("UPDATE lock_progress SET status='done', completed_at=COALESCE(completed_at, ?), points=CASE WHEN status='done' THEN points ELSE ? END WHERE team_id=? AND lock_id=?").run(now, l.points, teamId, id);
      if (l.decision && !this.decided(teamId, l.decision.id)) {
        const opt = l.decision.options.find((o) => o.correct) ?? l.decision.options[0];
        this.db.prepare("INSERT INTO decision_ledger(team_id,lock_id,decision_id,choice,effects_json,ts) VALUES(?,?,?,?,?,?)").run(teamId, l.id, l.decision.id, opt.id, JSON.stringify({ ...(opt.effects ?? {}), tag: opt.ledger_tag }), now);
      }
    }
    for (const id of after) {
      this.db.prepare("UPDATE lock_progress SET status=?, started_at=?, completed_at=NULL, attempts=0, hints_used=0, master_key_used=0, points=0 WHERE team_id=? AND lock_id=?").run(id === lockId ? "open" : "locked", id === lockId ? now : null, teamId, id);
      this.db.prepare("DELETE FROM decision_ledger WHERE team_id=? AND lock_id=?").run(teamId, id);
    }
    const reached = (id: string) => order.indexOf(id) >= 0 && order.indexOf(id) < idx;
    // tool state the later levels rely on: kept (or filled in) for levels already passed, cleared for the target and after
    const KV: Record<string, string[]> = { r1a_bandeja: ["wiz"], r3c_modelo: ["mb"], r5a_kpi: ["kpi_min"], r5b_dashboard: ["dash"] };
    for (const [id, keys] of Object.entries(KV)) if (!reached(id)) for (const k of keys) this.db.prepare("DELETE FROM team_kv WHERE team_id=? AND k=?").run(teamId, k);
    if (reached("r1a_bandeja")) this.saveLoaderTruth(teamId);
    if (reached("r5a_kpi") && !this.kvGet(teamId, "kpi_min")) this.kvSet(teamId, "kpi_min", "30");
    if (!reached("r4b_entrevistas")) this.db.prepare("DELETE FROM events_log WHERE team_id=? AND type='clue'").run(teamId);
    if (!reached("f_comision")) {
      this.db.prepare("DELETE FROM commission_turns WHERE team_id=?").run(teamId);
      this.db.prepare("DELETE FROM events_log WHERE team_id=? AND type='commission_result'").run(teamId);
    }
    this.log(teamId, "jump", { lock: lockId });
    this.notify(teamId, "state_update");
    return { lock: lockId };
  }

  setPaused(paused: boolean) {
    this.db.prepare("UPDATE sessions SET paused_at=?").run(paused ? this.now() : null);
    const teams = this.db.prepare("SELECT id FROM teams").all() as any[];
    teams.forEach((t) => this.notify(t.id, paused ? "paused" : "state_update"));
  }

  overview() {
    const teams = this.db.prepare("SELECT id FROM teams").all() as any[];
    const paused = !!(this.db.prepare("SELECT paused_at FROM sessions ORDER BY rowid LIMIT 1").get() as any)?.paused_at;
    return { paused, teams: teams.map((t) => {
      const s = this.state(t.id);
      const cur = s.locks.find((l) => l.status === "open");
      return {
        teamId: s.teamId, alias: s.alias, score: s.score, meters: s.meters, currentLock: cur?.id ?? null,
        hintsUsed: cur?.hintsUsed ?? 0, minutesInLock: cur?.startedAt ? Math.round((this.now() - cur.startedAt) / 60000) : 0,
        done: s.locks.filter((l) => l.status === "done").length, total: s.locks.length,
      };
    }) };
  }
}
