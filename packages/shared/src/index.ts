import { z } from "zod";

// ---------- i18n text (es required, gl optional until strict validation) ----------
export const LANGS = ["es", "gl"] as const;
export type Lang = (typeof LANGS)[number];
export const LText = z.union([z.string(), z.object({ es: z.string(), gl: z.string().optional() })]);
export type LTextT = z.infer<typeof LText>;
export const tr = (t: LTextT, lang: Lang): string => (typeof t === "string" ? t : (t[lang] ?? t.es));

// ---------- profiles ----------

// ---------- content schemas ----------
export const LOCK_TYPES = ["code", "build", "decision", "verify_ai", "interview", "chart", "model", "final"] as const;
export const Effects = z.object({ quality: z.number().optional(), trust: z.number().optional(), compliance: z.number().optional(), points: z.number().optional() }).partial();
export type EffectsT = z.infer<typeof Effects>;

export const DecisionOption = z.object({
  id: z.string(), label: LText, explain: LText.optional(), effects: Effects.default({}), ledger_tag: z.string(), correct: z.boolean().optional(),
});
export const Decision = z.object({ id: z.string(), options: z.array(DecisionOption).min(2) });

export const Lock = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  room: z.string(),
  type: z.enum(LOCK_TYPES),
  title: LText,
  story: LText,
  answer_hint: LText.optional(), // plain-words explanation of WHAT to type in the code box
  docs_needed: z.array(z.string()).default([]), // project documents (content/docs.yaml) the level relies on; they unlock with it
  tools: z.array(z.string()).default([]),
  decision: Decision.optional(),
  answer: z.object({ source: z.string(), normalize: z.enum(["text", "digits_only", "report"]).default("text") }).optional(),
  /** report fields that accept any number in a range (server only), e.g. the KPI minimum of discharges */
  numeric_ranges: z.array(z.object({ field: z.string(), min: z.number(), max: z.number(), canonical: z.string() })).default([]),
  validator: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("privacy_rubric"), rubric: z.string() }),
      z.object({ type: z.literal("ml_train"), min_auc: z.number(), min_features: z.number().int().default(2) }),
      z.object({ type: z.literal("ml_threshold"), capacity: z.number(), min_sensitivity: z.number() }),
      z.object({ type: z.literal("ml_equity"), min_chars: z.number().int().default(40) }),
      z.object({ type: z.literal("commission"), turns: z.number().int().default(6) }),
      z.object({ type: z.literal("interview"), required_clues: z.number().int().positive(), clues: z.array(z.string()) }),
      z.object({ type: z.literal("chart_rules"), mode: z.enum(["build", "review"]), max_findings: z.number().int().nonnegative().default(0) }),
      z.object({
        type: z.literal("verify_claims"), answer_key: z.string(), false_positive_penalty: z.number().default(10),
        
      }),
    ])
    .optional(),
  points: z.number().int().nonnegative(),
  time_target_min: z.number().positive(),
  hints: z.array(LText).length(3), // the help ladder Lumi hands out (levels 1-3), from a nudge to an almost-solution
  solution: LText.optional(), // level 4 of the ladder: the full solution. Server only; "{answer}" is filled with the real value
  next: z.string().optional(),
});
export type LockT = z.infer<typeof Lock>;

export const Room = z.object({
  id: z.string(), title: LText, intro: LText, target_minutes: z.number(), soft_cap_pct: z.number().default(25), hard_cap_pct: z.number().default(50),
  locks: z.array(z.string()).min(1),
  /** what the explorer and the briefing call the room: «Sala 1 · Ingesta» (the id stays R1) */
  number: z.string().optional(), stage: LText.optional(), icon: z.string().optional(),
  /** the room briefing shown before its first level: what you will do (short bullets) */
  briefing: z.array(LText).default([]),
});
export type RoomT = z.infer<typeof Room>;

export const Guide = z.object({
  goal: LText, steps: z.array(LText).min(1), why: LText, job: LText.optional(), terms: z.array(z.string()).default([]),
});
export type GuideT = z.infer<typeof Guide>;
export const Glossary = z.record(z.object({ term: LText, def: LText }));
/** primer: a short explainer shown in the room briefing before any level (e.g. what a table is), Markdown body. */
export const RoomGuide = z.object({ context: LText, learn: LText, primer: z.object({ title: LText, body: LText }).optional() });
export const GuidesFile = z.object({ rooms: z.record(RoomGuide), locks: z.record(Guide) });
/** A project document shown in the explorer (docs/*.md). It appears when the first level that needs it is reached. */
export const ProjectDoc = z.object({ id: z.string(), path: z.string().regex(/^docs\/[a-z0-9-]+\.md$/), title: LText, body: LText });
export const SessionConfig = z.object({
  target_minutes: z.number().default(180), hint_gate_minutes: z.number().default(7),
  hint_penalty: z.tuple([z.number(), z.number(), z.number()]).default([5, 10, 20]), master_key_penalty: z.number().default(60),
  /** Lumi's help ladder: level n (1-3 hints, 4 = solution) unlocks after help_gate_attempts[n-1] failed tries OR help_gate_minutes[n-1] minutes in the level */
  solution_penalty: z.number().default(40),
  help_gate_attempts: z.tuple([z.number(), z.number(), z.number(), z.number()]).default([0, 1, 2, 3]),
  help_gate_minutes: z.tuple([z.number(), z.number(), z.number(), z.number()]).default([0, 3, 6, 10]),
  /** confidence lost each time the team uses an AI character (27-nov): Lumi's chat, the interviews, the dashboard critic */
  ai_use_penalty: z.object({ lumi: z.number().default(1), npc: z.number().default(0), critic: z.number().default(0) }).default({}),
  ai_credits: z.number().default(20), show_leaderboard: z.boolean().default(false), auto_master_key: z.boolean().default(false),
  meters_start: z.object({ trust: z.number(), compliance: z.number(), quality: z.number() }).default({ trust: 60, compliance: 70, quality: 40 }),
  rooms: z.array(z.string()),
});
export type SessionConfigT = z.infer<typeof SessionConfig>;

// ---------- runtime types shared by client/server ----------
export interface Meters { trust: number; compliance: number; quality: number; ai_credits: number }
export interface LockStateView {
  id: string; room: string; type: string; title: string; story: string; points: number; status: "locked" | "open" | "done";
  attempts: number; hintsUsed: number; hints: string[]; decision?: { id: string; options: { id: string; label: string; explain?: string }[] };
  timeTargetMin: number; tools: string[]; answerHint?: string;
  /** a level already passed: what the team delivered (its accepted answer) and the option it chose, to review it read-only */
  mine?: { code?: string; decision?: string; options?: { label: string; explain?: string; chosen: boolean }[] };
  /** the project documents that explain this level (open in a tab) */
  docs?: { path: string; title: string }[];
  guide?: { goal: string; steps: string[]; why: string; job?: string; terms: { term: string; def: string }[] };
  roomInfo?: { id: string; title: string; context: string; learn: string; first: boolean }; startedAt?: number; hintAvailableAt?: number;
  /** Lumi's help ladder for the open level: what is unlocked next and when */
  help?: HelpStatus;
  /** the full solution, only once the team has asked Lumi for it (help level 4) */
  solution?: string;
}
export interface HelpStatus {
  used: number; max: 4;
  next: null | { level: number; penalty: number; unlocked: boolean; waitSeconds: number; attemptsNeeded: number };
}
export interface RoomView { id: string; title: string; number?: string; stage?: string; icon?: string; intro: string; context?: string; learn?: string; primer?: { title: string; body: string }; briefing: string[]; targetMinutes: number }
export interface TeamState {
  teamId: string; alias: string; lang: Lang; score: number; meters: Meters;
  startedAt: number; pausedAt: number | null; currentLockId: string | null; locks: LockStateView[];
  rooms: RoomView[];
  /** clues found in the interviews (R4B) */
  clues?: string[];
  docs: { id: string; path: string; title: string; body: string }[]; glossary: { term: string; def: string }[]; serverNow: number;
  /** confidence each AI use costs (0 = free) */
  aiCost?: { lumi: number; npc: number; critic: number };
}

// ---------- answer normalisation (must mirror data/common.py::normalize) ----------
export function normalizeCode(v: string, mode: "text" | "digits_only" | "report" = "text"): string {
  const s = v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x00-\x7f]/g, "");
  let out = s.toUpperCase().replace(/\s+/g, "").replace(/[.,]/g, "");
  if (mode === "digits_only") out = out.replace(/\D/g, "");
  return out;
}
/** Candidates to hash: the normalised value, plus without leading zeros for numeric codes. */
export function codeCandidates(v: string, mode: "text" | "digits_only" | "report" = "text"): string[] {
  if (mode === "report") return [v.trim()];
  const n = normalizeCode(v, mode);
  const c = [n];
  if (/^\d+$/.test(n)) c.push(String(BigInt(n)));
  return [...new Set(c)];
}

// ---------- request schemas ----------
export const JoinReq = z.object({ teamAlias: z.string().min(2).max(24) });
export const SubmitReq = z.object({ teamId: z.string(), code: z.string().max(6000), lang: z.enum(LANGS).optional() });
export const HintReq = z.object({ teamId: z.string(), level: z.number().int().min(1).max(4) });
export const DecisionReq = z.object({ teamId: z.string(), lockId: z.string(), optionId: z.string() });

export * from "./duck";
export * from "./dbt";
export * from "./csv";
export * from "./raw";
export * from "./files";
export * from "./charts";
export * from "./items";
export * from "./ml";
