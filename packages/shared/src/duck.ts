// Minimal engine abstraction so the same dbt runner works in the browser (async worker) and in node tests.
export interface SqlEngine {
  /** Run a statement; resolve rows as plain objects. */
  query(sql: string): Promise<Record<string, any>[]>;
}
export const SQL_FORBIDDEN = /\b(copy|attach|detach|install|load|export|import|pragma|call|set|reset|checkpoint|vacuum|read_csv|read_csv_auto|read_parquet|read_json|glob|httpfs|http_get|getenv|system)\b/i;
const ALLOWED_START = /^\s*(with|select|create\s+(or\s+replace\s+)?(table|view)|describe|summarize)\b/i;
/** Guard for player-editable SQL (SPEC 10.1): only SELECT / CTAS / CREATE VIEW over raw, staging, marts. */
export function guardSql(sql: string): { ok: true } | { ok: false; reason: string } {
  const s = sql.trim().replace(/;+\s*$/, "");
  if (s.includes(";")) return { ok: false, reason: "Solo se permite una sentencia a la vez." };
  if (!ALLOWED_START.test(s)) return { ok: false, reason: "Solo se permiten consultas SELECT o crear tablas/vistas." };
  const noStrings = s.replace(/'([^']|'')*'/g, "''");
  if (SQL_FORBIDDEN.test(noStrings)) return { ok: false, reason: "Esa instrucción no está permitida en este juego." };
  return { ok: true };
}

/** Arrow values -> plain JS: bigint -> number, HUGEINT (Uint32Array of 4 limbs) -> number. */
export function plainValue(v: any): any {
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Uint32Array && v.length === 4) return v[0] + v[1] * 2 ** 32 + v[2] * 2 ** 64 + v[3] * 2 ** 96;
  return v;
}
