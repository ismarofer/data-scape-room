// What the browser knows about the player's own workspace; sent to Lumi so it can see what is done and what is being tried.
// The server re-checks the draft itself (never trusts the client) and keeps the solution to itself.
export interface WorkCtx {
  tables: { name: string; rows: number }[];
  lastQuery: { sql: string; result: string } | null;
  draft?: string;
  draftText?: string;
  view?: string;
}
const ctx: { tables: WorkCtx["tables"]; lastQuery: WorkCtx["lastQuery"]; draft: { lockId: string; draft: string; text?: string } | null; view: string } = { tables: [], lastQuery: null, draft: null, view: "" };
export const setTables = (t: WorkCtx["tables"]) => { ctx.tables = t; };
export function setLastQuery(sql: string, rows: Record<string, any>[] | string) {
  const result = typeof rows === "string" ? `error: ${rows}` : rows.length === 0 ? "sin resultados" : `${rows.length} fila(s); primera: ${JSON.stringify(rows[0])}`;
  ctx.lastQuery = { sql, result: result.slice(0, 450) };
}
/**
 * The level's tool reports what the team has set up so far, in the same format it would submit (`draft`)
 * and, optionally, in plain words (`text`). Call it on every change; it only travels when the team talks to Lumi.
 */
let currentLock: string | null = null;
/** The open level: only its tool may report a draft (a solved level shown read-only reuses the same tools). */
export const setCurrentLock = (id: string | null) => { currentLock = id; };
export function setDraft(lockId: string, draft: string, text?: string) { if (currentLock && lockId !== currentLock) return; ctx.draft = { lockId, draft: draft.slice(0, 6000), text: text?.slice(0, 1500) }; }
/** What the player has open in the centre right now (a file, a table, a solved level…). */
export const setView = (v: string) => { ctx.view = v.slice(0, 200); };
export const getWorkContext = (lockId?: string | null): WorkCtx => ({
  tables: ctx.tables.slice(0, 30), lastQuery: ctx.lastQuery,
  ...(ctx.draft && ctx.draft.lockId === lockId ? { draft: ctx.draft.draft, draftText: ctx.draft.text } : {}),
  ...(ctx.view ? { view: ctx.view } : {}),
});

/** Small event bus between the level tools and the side panels (no global store needed). */
export type UiEvent =
  | { type: "lumi:ask"; text?: string } // open/focus Lumi, optionally with a question ready
  | { type: "lab:preset"; table: string; op: string; col?: string } // prepare the Query Lab
  | { type: "doc:open"; path: string } // open a project document in a tab
  | { type: "lab:refresh" } // tables changed (e.g. after «▶ Calcular»): the Query Lab reads them again
  | { type: "lab:open" }; // open (or bring to the front) the Query Lab tab
/** The last preset asked for (e.g. «🔬 Comprobar» in Ada's audit): the lab applies it when its tab mounts after the click. */
export let pendingPreset: Extract<UiEvent, { type: "lab:preset" }> | null = null;
export const takePreset = () => { const p = pendingPreset; pendingPreset = null; return p; };
export const emit = (e: UiEvent) => {
  if (e.type === "lab:preset") { pendingPreset = e; window.dispatchEvent(new CustomEvent("ca-ui", { detail: { type: "lab:open" } })); }
  window.dispatchEvent(new CustomEvent("ca-ui", { detail: e }));
};
export function onUi(fn: (e: UiEvent) => void): () => void {
  const h = (ev: Event) => fn((ev as CustomEvent<UiEvent>).detail);
  window.addEventListener("ca-ui", h);
  return () => window.removeEventListener("ca-ui", h);
}
