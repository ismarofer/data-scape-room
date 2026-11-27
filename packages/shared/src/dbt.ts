import type { SqlEngine } from "./duck";

// ---------- project definition (loaded from content/models) ----------
export interface SlotOption { id: string; sql: string; explain?: string; correct?: boolean; plain?: string | { es: string; gl?: string } }
export interface SlotDef { label: string; options: SlotOption[] }
export interface ModelDef { name: string; sql: string; slots?: Record<string, SlotDef> }
export type TestSpec =
  | { kind: "not_null"; model: string; column: string }
  | { kind: "unique"; model: string; column: string }
  | { kind: "relationships"; model: string; column: string; toModel: string; toColumn: string }
  | { kind: "accepted_values"; model: string; column: string; values: string[] }
  | { kind: "expression_is_true"; model: string; expression: string; severity: "error" | "warn" };
export interface Project { models: ModelDef[]; tests: TestSpec[] }

export const schemaOf = (name: string) => (name.startsWith("stg_") ? "staging" : "marts");
const REF = /\{\{\s*ref\(\s*['"]([\w]+)['"]\s*\)\s*\}\}/g;
const SRC = /\{\{\s*source\(\s*['"](\w+)['"]\s*,\s*['"](\w+)['"]\s*\)\s*\}\}/g;
const CONF = /\{\{\s*config\([^}]*\)\s*\}\}/g;
const SLOT = /\{\{\s*slot:(\w+)(?::(\w+))?\s*\}\}/g;

export const refsOf = (sql: string): string[] => [...sql.matchAll(REF)].map((m) => m[1]);

/** Replace slots (using the player's choice), ref(), source() and config(). */
export function compile(model: ModelDef, choice: Record<string, string>): string {
  return model.sql
    .replace(CONF, "")
    .replace(SLOT, (_m, id, arg) => {
      const def = model.slots?.[id];
      const opt = def?.options.find((o) => o.id === choice[id]);
      if (!opt) throw new Error(`Falta elegir la pieza «${def?.label ?? id}»`);
      return arg ? opt.sql.replace(/\{col\}/g, arg) : opt.sql;
    })
    .replace(REF, (_m, n) => `${schemaOf(n)}.${n}`)
    .replace(SRC, (_m, s, t) => `${s}.${t}`)
    .trim();
}

/** The given models plus everything they depend on. */
export function closure(models: ModelDef[], names: string[]): string[] {
  const by = new Map(models.map((m) => [m.name, m]));
  const seen = new Set<string>();
  const visit = (n: string) => { if (seen.has(n)) return; seen.add(n); refsOf(by.get(n)!.sql).forEach(visit); };
  names.forEach(visit);
  return [...seen];
}

/** Topological order of models (Kahn). Throws on cycles/unknown refs. */
export function dag(models: ModelDef[]): { order: string[]; edges: [string, string][] } {
  const names = new Set(models.map((m) => m.name));
  const edges: [string, string][] = [];
  const indeg = new Map(models.map((m) => [m.name, 0]));
  for (const m of models) for (const r of new Set(refsOf(m.sql))) {
    if (!names.has(r)) throw new Error(`${m.name}: ref a modelo inexistente ${r}`);
    edges.push([r, m.name]);
    indeg.set(m.name, (indeg.get(m.name) ?? 0) + 1);
  }
  const order: string[] = [];
  const q = models.filter((m) => indeg.get(m.name) === 0).map((m) => m.name);
  while (q.length) {
    const n = q.shift()!;
    order.push(n);
    for (const [a, b] of edges) if (a === n) { indeg.set(b, indeg.get(b)! - 1); if (indeg.get(b) === 0) q.push(b); }
  }
  if (order.length !== models.length) throw new Error("El proyecto tiene un ciclo de dependencias");
  return { order, edges };
}

// ---------- execution ----------
export interface ModelResult { model: string; status: "ok" | "error" | "skipped"; rows?: number; error?: string }
export interface TestResult { id: string; model: string; test: string; column?: string; status: "pass" | "fail" | "warn" | "skipped"; failures: number; message: string }
export interface RunReport { models: ModelResult[]; tests: TestResult[]; ok: boolean }

const friendly = (e: unknown) => String((e as Error)?.message ?? e).split("\n")[0].slice(0, 240);
const q1 = async (eng: SqlEngine, sql: string) => Number(Object.values((await eng.query(sql))[0] ?? { n: 0 })[0]);

export function testSql(t: TestSpec): { sql: string; id: string; label: string; message: (n: number) => string } {
  const tbl = `${schemaOf(t.model)}.${t.model}`;
  switch (t.kind) {
    case "not_null":
      return { id: `${t.kind}:${t.model}.${t.column}`, label: `not_null(${t.column})`, sql: `select count(*) from ${tbl} where ${t.column} is null`, message: (n) => `${n} filas con ${t.column} vacío` };
    case "unique":
      return { id: `${t.kind}:${t.model}.${t.column}`, label: `unique(${t.column})`, sql: `select count(*) from (select ${t.column} from ${tbl} group by 1 having count(*) > 1)`, message: (n) => `${n} valores de ${t.column} repetidos` };
    case "relationships":
      return { id: `${t.kind}:${t.model}.${t.column}`, label: `relationships(${t.column} → ${t.toModel}.${t.toColumn})`, sql: `select count(*) from ${tbl} where ${t.column} is not null and ${t.column} not in (select ${t.toColumn} from ${schemaOf(t.toModel)}.${t.toModel})`, message: (n) => `${n} filas apuntan a un ${t.toModel} que no existe` };
    case "accepted_values":
      return { id: `${t.kind}:${t.model}.${t.column}`, label: `accepted_values(${t.column})`, sql: `select count(*) from ${tbl} where ${t.column} is not null and ${t.column} not in (${t.values.map((v) => `'${v.replace(/'/g, "''")}'`).join(",")})`, message: (n) => `${n} filas con valores no permitidos en ${t.column}` };
    case "expression_is_true":
      return { id: `${t.kind}:${t.model}:${t.expression}`, label: `expresión: ${t.expression}`, sql: `select count(*) from ${tbl} where not coalesce(${t.expression}, false)`, message: (n) => `${n} filas no cumplen «${t.expression}»` };
  }
}

export async function runProject(eng: SqlEngine, p: Project, choices: Record<string, Record<string, string>>, opts: { only?: string[]; onModel?: (r: ModelResult) => void } = {}): Promise<RunReport> {
  const { order } = dag(p.models);
  const byName = new Map(p.models.map((m) => [m.name, m]));
  const models: ModelResult[] = [];
  const failed = new Set<string>();
  await eng.query("create schema if not exists staging");
  await eng.query("create schema if not exists marts");
  for (const name of order) {
    if (opts.only && !opts.only.includes(name)) continue;
    const m = byName.get(name)!;
    let r: ModelResult;
    if (refsOf(m.sql).some((d) => failed.has(d))) r = { model: name, status: "skipped", error: "Depende de un modelo que ha fallado" };
    else {
      try {
        const sql = compile(m, choices[name] ?? {});
        await eng.query(`create or replace table ${schemaOf(name)}.${name} as ${sql}`);
        r = { model: name, status: "ok", rows: await q1(eng, `select count(*) from ${schemaOf(name)}.${name}`) };
      } catch (e) {
        r = { model: name, status: "error", error: friendly(e) };
      }
    }
    if (r.status !== "ok") failed.add(name);
    models.push(r);
    opts.onModel?.(r);
  }
  const tests: TestResult[] = [];
  for (const t of p.tests) {
    if (opts.only && (!opts.only.includes(t.model) || (t.kind === "relationships" && !opts.only.includes(t.toModel)))) continue;
    if (!p.models.some((m) => m.name === t.model) || (t.kind === "relationships" && !p.models.some((m) => m.name === t.toModel))) continue;
    const spec = testSql(t);
    const needs = [t.model, ...(t.kind === "relationships" ? [t.toModel] : [])];
    if (needs.some((n) => failed.has(n))) { tests.push({ id: spec.id, model: t.model, test: spec.label, column: "column" in t ? t.column : undefined, status: "skipped", failures: 0, message: "No se pudo ejecutar el modelo" }); continue; }
    try {
      const n = await q1(eng, spec.sql);
      const sev = t.kind === "expression_is_true" ? t.severity : "error";
      tests.push({ id: spec.id, model: t.model, test: spec.label, column: "column" in t ? t.column : undefined, status: n === 0 ? "pass" : sev === "warn" ? "warn" : "fail", failures: n, message: n === 0 ? "Todo correcto" : spec.message(n) });
    } catch (e) {
      tests.push({ id: spec.id, model: t.model, test: spec.label, status: "fail", failures: -1, message: friendly(e) });
    }
  }
  return { models, tests, ok: models.every((m) => m.status === "ok") && tests.every((t) => t.status === "pass" || t.status === "warn") };
}

/** Canonical string reported to the server for `build` locks (hashed there; never contains expected values in clear). */
export function buildReport(r: RunReport, choices: Record<string, Record<string, string>>): string {
  const rows = r.models.map((m) => `${m.model}=${m.rows ?? "x"}`).join(",");
  const sl = Object.keys(choices).sort().map((m) => `${m}:` + Object.keys(choices[m]).sort().map((k) => `${k}=${choices[m][k]}`).join("+")).join(";");
  return `rows[${rows}]|failed[${r.tests.filter((t) => t.status === "fail" || t.status === "skipped").length}]|slots[${sl}]`;
}
