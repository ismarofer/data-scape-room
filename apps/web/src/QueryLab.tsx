import { useEffect, useMemo, useState } from "react";
import { guardSql, type Lang } from "@codigo-alta/shared";
import { ensureCanon, getEngine } from "./duck";
import { restoreRaw } from "./raw";
import { onUi, setLastQuery, takePreset } from "./workContext";
import { lookup, useCatalog } from "./FileInfo";

type Op = "rows" | "distinct" | "values" | "pct_by" | "minmax" | "repeated_n" | "repeated_list" | "not_in" | "peek";
interface OpDef { id: Op; es: string; gl: string; needsCol: boolean }
const OPS: OpDef[] = [
  { id: "rows", es: "Contar cuántas filas hay", gl: "Contar cantas filas hai", needsCol: false },
  { id: "distinct", es: "Contar cuántos valores DISTINTOS hay en una columna", gl: "Contar cantos valores DISTINTOS hai nunha columna", needsCol: true },
  { id: "values", es: "Ver qué valores hay en una columna y cuántas veces sale cada uno", gl: "Ver que valores hai nunha columna e cantas veces sae cada un", needsCol: true },
  // grouped percentage (26-nov): enough to answer «which centre has the highest rate» in the lab, with the team's minimum
  { id: "pct_by", es: "Para cada valor de una columna: cuántas filas hay y qué % tiene una marca (sí/no)", gl: "Para cada valor dunha columna: cantas filas hai e que % ten unha marca (si/non)", needsCol: true },
  { id: "minmax", es: "Ver el valor más pequeño y el más grande de una columna", gl: "Ver o valor máis pequeno e o máis grande dunha columna", needsCol: true },
  { id: "repeated_n", es: "Contar cuántos valores de una columna salen más de una vez", gl: "Contar cantos valores dunha columna saen máis dunha vez", needsCol: true },
  { id: "repeated_list", es: "Ver qué valores de una columna se repiten (y cuántas veces)", gl: "Ver que valores dunha columna se repiten (e cantas veces)", needsCol: true },
  { id: "not_in", es: "Contar filas cuyo valor NO aparece en otra tabla", gl: "Contar filas cuxo valor NON aparece noutra táboa", needsCol: true },
  { id: "peek", es: "Ver las 10 primeras filas", gl: "Ver as 10 primeiras filas", needsCol: false },
];
type CondOp = "eq" | "neq" | "empty" | "notempty" | "contains";
const CONDS: { id: CondOp; es: string; gl: string; needsVal: boolean }[] = [
  { id: "eq", es: "es igual a", gl: "é igual a", needsVal: true },
  { id: "neq", es: "es distinta de", gl: "é distinta de", needsVal: true },
  { id: "empty", es: "está vacía", gl: "está baleira", needsVal: false },
  { id: "notempty", es: "no está vacía", gl: "non está baleira", needsVal: false },
  { id: "contains", es: "contiene", gl: "contén", needsVal: true },
];
interface Cond { col: string; op: CondOp; val: string }
const MAX_CONDS = 3;
// Any table of the browser database can be asked: raw (as it arrived), marts (your calculation) and canon (the clean final model).
const TABLE_LABEL: Record<string, { es: string; gl: string }> = {
  "raw.encounters": { es: "todos los encuentros de los 4 hospitales juntos (incluye el reenvío de H2)", gl: "todos os encontros dos 4 hospitais xuntos (inclúe o reenvío de H2)" },
  "raw.patients": { es: "los pacientes", gl: "os pacientes" },
  "raw.organizations": { es: "los centros sanitarios", gl: "os centros sanitarios" },
  "raw.conditions": { es: "los diagnósticos", gl: "os diagnósticos" },
  "marts.int_admission_episodes": { es: "vuestro cálculo: episodios de ingreso", gl: "o voso cálculo: episodios de ingreso" },
  "marts.fct_admission": { es: "vuestro cálculo: episodios con la marca de reingreso", gl: "o voso cálculo: episodios coa marca de reingreso" },
  "marts.dim_patient": { es: "dimensión paciente: una fila por persona", gl: "dimensión paciente: unha fila por persoa" },
  "marts.dim_hospital": { es: "dimensión hospital: una fila por centro", gl: "dimensión hospital: unha fila por centro" },
  "marts.dim_date": { es: "dimensión fecha: una fila por día", gl: "dimensión data: unha fila por día" },
  "marts.fct_condition": { es: "hechos: un diagnóstico por fila", gl: "feitos: un diagnóstico por fila" },
  "canon.fct_admission_clean": { es: "modelo final limpio (episodios sin datos raros)", gl: "modelo final limpo (episodios sen datos raros)" },
  "canon.anomalies": { es: "los registros raros que encontraron los detectores", gl: "os rexistros raros que atoparon os detectores" },
};
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

function condSql(c: Cond): string {
  switch (c.op) {
    case "eq": return `lower(cast(${c.col} as varchar)) = lower(${q(c.val.trim())})`;
    case "neq": return `lower(cast(${c.col} as varchar)) <> lower(${q(c.val.trim())})`;
    case "empty": return `coalesce(cast(${c.col} as varchar), '') = ''`;
    case "notempty": return `coalesce(cast(${c.col} as varchar), '') <> ''`;
    default: return `lower(cast(${c.col} as varchar)) like lower(${q("%" + c.val.trim() + "%")})`;
  }
}
const condReady = (c: Cond) => !!c.col && (!CONDS.find((x) => x.id === c.op)!.needsVal || !!c.val.trim());

/** pct: the yes/no column whose % is calculated and the minimum of rows a group needs to be shown. */
function build(op: Op, table: string, col: string, conds: Cond[], other: { table: string; col: string }, pct: { flag: string; min: string } = { flag: "", min: "" }): string {
  const T = table; // full name: schema.table
  const base = conds.filter(condReady).map(condSql);
  const w = (extra: string[] = [], pad = "") => { const all = [...extra, ...base]; return all.length ? `\n${pad}where ${all.join("\n" + pad + "  and ")}` : ""; };
  switch (op) {
    case "rows": return `select count(*) as filas\nfrom ${T}${w()}`;
    case "distinct": return `select count(distinct ${col}) as valores_distintos\nfrom ${T}${w()}`;
    case "values": return `select ${col}, count(*) as veces\nfrom ${T}${w()}\ngroup by ${col}\norder by veces desc\nlimit 20`;
    case "pct_by": {
      const yes = `sum(case when ${pct.flag || "false"} then 1 else 0 end)`;
      const min = Number(pct.min) >= 1 ? `\nhaving count(*) >= ${Math.round(Number(pct.min))}` : "";
      return `select ${col}, count(*) as filas, ${yes} as con_marca,\n  round(100.0 * ${yes} / count(*), 1) as porcentaje\nfrom ${T}${w()}\ngroup by ${col}${min}\norder by porcentaje desc\nlimit 20`;
    }
    case "minmax": return `select min(${col}) as menor, max(${col}) as mayor\nfrom ${T}${w()}`;
    case "repeated_n": return `select count(*) as valores_repetidos\nfrom (\n  select ${col} from ${T}${w([], "  ")}\n  group by ${col}\n  having count(*) > 1\n)`;
    case "repeated_list": return `select ${col}, count(*) as veces\nfrom ${T}${w()}\ngroup by ${col}\nhaving count(*) > 1\norder by veces desc\nlimit 20`;
    case "not_in": return `select count(*) as filas_sin_pareja\nfrom ${T}${w([`${col} not in (\n    select ${other.col} from ${other.table}\n    where ${other.col} is not null\n  )`])}`;
    default: return `select *\nfrom ${T}${w()}\nlimit 10`;
  }
}

/** Friendly SQL builder: pick a table, a question and up to 3 conditions; read the SQL it writes; run it. No typing SQL. */
export function QueryLab({ teamId, lang }: { teamId: string; lang: Lang }) {
  const es = lang === "es";
  const [schema, setSchema] = useState<Record<string, string[]> | null>(null);
  const [missing, setMissing] = useState(false);
  const [table, setTable] = useState("raw.encounters");
  const [op, setOp] = useState<Op>("rows");
  const [col, setCol] = useState("encounter_id");
  const [conds, setConds] = useState<Cond[]>([]);
  const [other, setOther] = useState({ table: "raw.patients", col: "patient_id" });
  const [flags, setFlags] = useState<Record<string, string[]>>({}); // yes/no (boolean) columns of every table
  const [pct, setPct] = useState({ flag: "", min: "" });
  const [reload, setReload] = useState(0);
  const [out, setOut] = useState<Record<string, any>[] | string | null>(null);
  const [flash, setFlash] = useState(false);
  const cat = useCatalog(lang);
  // «🔬 Comprobar» in Ada's audit prepares the lab (table + kind of question); the team does the rest
  useEffect(() => {
    // a preset asked for before this tab existed (the click that opened it)
    const p = takePreset();
    if (p) { setTable(p.table.includes(".") ? p.table : `raw.${p.table}`); setOp(p.op as Op); if (p.col) setCol(p.col); }
  }, []);
  useEffect(() => onUi((e) => {
    if (e.type === "lab:refresh") { setReload((n) => n + 1); return; }
    if (e.type !== "lab:preset") return;
    takePreset();
    setTable(e.table.includes(".") ? e.table : `raw.${e.table}`); setOp(e.op as Op); if (e.col) setCol(e.col); setConds([]); setOut(null);
    setFlash(true); setTimeout(() => setFlash(false), 1500);
  }), []);

  useEffect(() => {
    (async () => {
      const rawOk = await restoreRaw(teamId);
      try { await ensureCanon(); } catch { /* the clean model is optional */ }
      const rows = await (await getEngine()).query("select table_schema, table_name, column_name, data_type from information_schema.columns where table_schema in ('raw', 'marts', 'canon') order by table_schema = 'raw' desc, table_schema, table_name, ordinal_position");
      const by: Record<string, string[]> = {}, fl: Record<string, string[]> = {};
      for (const r of rows) {
        (by[`${r.table_schema}.${r.table_name}`] ??= []).push(r.column_name);
        if (String(r.data_type).toUpperCase() === "BOOLEAN") (fl[`${r.table_schema}.${r.table_name}`] ??= []).push(r.column_name);
      }
      setFlags(fl);
      if (!rawOk && !Object.keys(by).length) { setMissing(true); return; }
      setMissing(false);
      setSchema(by);
    })().catch(() => setMissing(true));
  }, [teamId, reload]);

  const cols = schema?.[table] ?? [];
  const otherCols = schema?.[other.table] ?? [];
  useEffect(() => {
    if (!cols.length) return;
    if (!cols.includes(col)) setCol(cols[0]);
    setConds((cs) => cs.filter((c) => cols.includes(c.col)));
  }, [table, schema]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (otherCols.length && !otherCols.includes(other.col)) setOther((o) => ({ ...o, col: otherCols.includes(col) ? col : otherCols[0] })); }, [other.table, schema]); // eslint-disable-line react-hooks/exhaustive-deps
  const def = OPS.find((o) => o.id === op)!;
  const tableFlags = flags[table] ?? [];
  useEffect(() => { setPct((p) => ({ ...p, flag: tableFlags.includes(p.flag) ? p.flag : tableFlags[0] ?? "" })); }, [table, flags]); // eslint-disable-line react-hooks/exhaustive-deps
  const sql = useMemo(() => build(op, table, col || cols[0] || "encounter_id", conds, other, pct), [op, table, col, conds, other, cols, pct]);
  const incomplete = conds.some((c) => !condReady(c)) || (op === "pct_by" && !pct.flag);
  const reset = () => setOut(null);
  const setCond = (i: number, patch: Partial<Cond>) => { setConds((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c))); reset(); };

  const run = async () => {
    try {
      const g = guardSql(sql); if (!g.ok) throw new Error(g.reason);
      const rows = (await (await getEngine()).query(sql)).slice(0, 20);
      setOut(rows); setLastQuery(sql, rows);
    } catch (e) { setLastQuery(sql, (e as Error).message); setOut(es ? "No se ha podido hacer esa pregunta: " + (e as Error).message : "Non se puido facer esa pregunta: " + (e as Error).message); }
  };
  const tables = Object.keys(schema ?? {});
  const colInfo = (t: string, c: string) => lookup(cat, `db:${t}`)?.cols.find((x) => x.name.split(" / ").includes(c))?.text;

  return (
    <section className={`lab ${flash ? "flash" : ""}`} aria-label="Laboratorio de preguntas">
      <h3>🔬 Laboratorio de preguntas <button type="button" className="ghost" title={es ? "Volver a leer las tablas (por ejemplo, después de «▶ Calcular»)" : "Volver ler as táboas (por exemplo, despois de «▶ Calcular»)"} onClick={() => { setSchema(null); setReload((n) => n + 1); }}>↻ {es ? "Actualizar tablas" : "Actualizar táboas"}</button></h3>
      <details className="whatsql">
        <summary>{es ? "¿Qué es SQL? (léelo si es tu primera vez)" : "Que é SQL? (léo se é a túa primeira vez)"}</summary>
        <p>{es ? "Los datos están guardados en TABLAS, parecidas a una hoja de Excel: cada fila es un caso y cada columna, una característica. SQL es el idioma con el que se le hacen preguntas a una tabla, por ejemplo «¿cuántas filas tienes?». Aquí NO tienes que escribirlo: eliges una tabla y una pregunta, y el laboratorio escribe la SQL por ti para que veas cómo es." : "Os datos están gardados en TÁBOAS, parecidas a unha folla de Excel: cada fila é un caso e cada columna, unha característica. SQL é o idioma co que se lle fan preguntas a unha táboa, por exemplo «cantas filas tes?». Aquí NON tes que escribilo: eliges unha táboa e unha pregunta, e o laboratorio escribe a SQL por ti para que vexas como é."}</p>
        <ul>
          <li><code>select</code> = {es ? "«muéstrame / calcula…»" : "«móstrame / calcula…»"}</li>
          <li><code>count(*)</code> = {es ? "«cuántas filas hay»" : "«cantas filas hai»"}</li>
          <li><code>from</code> = {es ? "«de qué tabla»" : "«de que táboa»"}</li>
          <li><code>where … and …</code> = {es ? "«quédate solo con las filas que cumplan TODAS estas condiciones»" : "«queda só coas filas que cumpran TODAS estas condicións»"}</li>
          <li><code>group by</code> {es ? "= «agrupa las filas que tienen el mismo valor»" : "= «agrupa as filas que teñen o mesmo valor»"}</li>
          <li><code>order by … desc</code> {es ? "= «ordena de mayor a menor»" : "= «ordena de maior a menor»"}</li>
          <li><code>having</code> {es ? "= «quédate solo con los grupos que cumplan…»" : "= «queda só cos grupos que cumpran…»"}</li>
        </ul>
        <p>{es ? "¿Dónde están las tablas? En el panel BASE DE DATOS de la izquierda (grupo «raw»): ahí las veis con sus columnas y podéis abrirlas. Aparecen cuando cargáis los ficheros en la sala anterior." : "Onde están as táboas? No panel BASE DE DATOS da esquerda (grupo «raw»): aí vedes as táboas coas súas columnas e podedes abrilas. Aparecen cando cargades os ficheiros na sala anterior."}</p>
      </details>

      {missing && <p className="err">{es ? "Todavía no hay datos cargados en este navegador. Cargad antes los ficheros de la sala «La bandeja de entrada»." : "Aínda non hai datos cargados neste navegador. Cargade antes os ficheiros da sala «A caixa de entrada»."}</p>}
      {!missing && !schema && <p>…</p>}
      {schema && (
        <>
          <div className="labrow stack">
            <label>① {es ? "¿Sobre qué tabla preguntas?" : "Sobre que táboa preguntas?"}
              <select value={table} onChange={(e) => { setTable(e.target.value); reset(); }}>
                {tables.map((t) => <option key={t} value={t}>{t}{TABLE_LABEL[t] ? ` — ${TABLE_LABEL[t][lang]}` : ""}</option>)}
              </select>
            </label>
            <label>② {es ? "¿Qué quieres saber?" : "Que queres saber?"}
              <select value={op} onChange={(e) => { setOp(e.target.value as Op); reset(); }}>
                {OPS.map((o) => <option key={o.id} value={o.id}>{o[lang]}</option>)}
              </select>
            </label>
            {def.needsCol && (
              <label>③ {op === "not_in" ? (es ? "¿Qué columna de esta tabla?" : "Que columna desta táboa?") : (es ? "¿En qué columna?" : "En que columna?")}
                <select value={col} onChange={(e) => { setCol(e.target.value); reset(); }}>{cols.map((c) => <option key={c} value={c}>{c}{colInfo(table, c) ? ` — ${colInfo(table, c)}` : ""}</option>)}</select>
              </label>
            )}
          </div>
          {op === "pct_by" && (
            <div className="labrow">
              <label>{es ? "…y qué % tiene la marca" : "…e que % ten a marca"}
                {tableFlags.length
                  ? <select value={pct.flag} onChange={(e) => { setPct({ ...pct, flag: e.target.value }); reset(); }}>{tableFlags.map((c) => <option key={c} value={c}>{c}{colInfo(table, c) ? ` — ${colInfo(table, c)}` : ""}</option>)}</select>
                  : <em className="hint-small">{es ? "Esta tabla no tiene columnas de sí/no: elegid otra." : "Esta táboa non ten columnas de si/non: elixide outra."}</em>}
              </label>
              <label>{es ? "Solo grupos con al menos … filas (opcional)" : "Só grupos con polo menos … filas (opcional)"}
                <input type="number" min={1} max={100000} value={pct.min} onChange={(e) => { setPct({ ...pct, min: e.target.value }); reset(); }} placeholder={es ? "sin mínimo" : "sen mínimo"} aria-label={es ? "Mínimo de filas por grupo" : "Mínimo de filas por grupo"} />
              </label>
            </div>
          )}
          {op === "not_in" && (
            <div className="labrow">
              <label>{es ? "…que NO aparece en la tabla" : "…que NON aparece na táboa"}
                <select value={other.table} onChange={(e) => { setOther({ ...other, table: e.target.value }); reset(); }}>{tables.map((t) => <option key={t} value={t}>{t}</option>)}</select>
              </label>
              <label>{es ? "…en su columna" : "…na súa columna"}
                <select value={other.col} onChange={(e) => { setOther({ ...other, col: e.target.value }); reset(); }}>{otherCols.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </label>
            </div>
          )}

          <fieldset className="conds">
            <legend>④ {es ? "(Opcional) Condiciones: cuenta solo las filas que cumplan TODAS" : "(Opcional) Condicións: conta só as filas que cumpran TODAS"}</legend>
            {conds.map((c, i) => (
              <div key={i} className="condrow">
                <select aria-label={`${es ? "Columna de la condición" : "Columna da condición"} ${i + 1}`} value={c.col} onChange={(e) => setCond(i, { col: e.target.value })}>{cols.map((x) => <option key={x} value={x}>{x}</option>)}</select>
                <select aria-label={`${es ? "Tipo de condición" : "Tipo de condición"} ${i + 1}`} value={c.op} onChange={(e) => setCond(i, { op: e.target.value as CondOp })}>{CONDS.map((x) => <option key={x.id} value={x.id}>{x[lang]}</option>)}</select>
                {CONDS.find((x) => x.id === c.op)!.needsVal && <input aria-label={`${es ? "Valor de la condición" : "Valor da condición"} ${i + 1}`} value={c.val} onChange={(e) => setCond(i, { val: e.target.value })} placeholder={es ? "valor (ej.: inpatient)" : "valor (ex.: inpatient)"} />}
                <button type="button" className="ghost" aria-label={`${es ? "Quitar condición" : "Quitar condición"} ${i + 1}`} onClick={() => { setConds(conds.filter((_, j) => j !== i)); reset(); }}>✕</button>
              </div>
            ))}
            {conds.length < MAX_CONDS && <button type="button" className="ghost" onClick={() => { setConds([...conds, { col: cols[0] ?? "", op: "eq", val: "" }]); reset(); }}>＋ {es ? "Añadir una condición" : "Engadir unha condición"}</button>}
          </fieldset>

          <p className="hint-small">{es ? "Así se escribe tu pregunta en SQL:" : "Así se escribe a túa pregunta en SQL:"}</p>
          <pre className="sql">{sql}</pre>
          <button className="primary" onClick={run} disabled={incomplete}>▶ {es ? "Hacer la pregunta" : "Facer a pregunta"}</button>
          {typeof out === "string" && <p className="err">{out}</p>}
          {Array.isArray(out) && (out.length === 0
            ? <p>{es ? "Sin resultados (ninguna fila cumple eso)." : "Sen resultados (ningunha fila cumpre iso)."}</p>
            : <div className="scroll"><table className="prev"><thead><tr>{Object.keys(out[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead><tbody>{out.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>)}</tbody></table></div>)}
        </>
      )}
    </section>
  );
}
