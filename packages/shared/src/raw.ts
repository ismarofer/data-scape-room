import type { SqlEngine } from "./duck";
import type { Analysis } from "./csv";

export interface TextEngine extends SqlEngine { registerText(name: string, text: string): void | Promise<void>; registerBuffer?(name: string, bytes: Uint8Array): void | Promise<void> }
const cell = (c: string) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
export const toCsv = (header: string[], rows: string[][]) => [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");

/** Load the valid rows of an analysed file into raw.<table> (everything VARCHAR: typing happens in staging). */
export async function loadRaw(eng: TextEngine, table: string, a: Analysis) {
  await eng.query("create schema if not exists raw");
  const file = `upload_${table}.csv`;
  await eng.registerText(file, toCsv(a.header, a.valid));
  await eng.query(`create or replace table raw.${table} as select * from read_csv('${file}', header=true, all_varchar=true, delim=',', quote='"')`);
  return Number((await eng.query(`select count(*) n from raw.${table}`))[0].n);
}
/** raw.encounters = every encounter feed (incl. the H2 resend) stacked by column name, tagged with its source file. */
export async function consolidateEncounters(eng: SqlEngine, tables: string[]) {
  const sel = tables.map((t) => `select *, '${t}' as source_file from raw.${t}`).join(" union all by name ");
  await eng.query(`create or replace table raw.encounters as ${sel}`);
}
