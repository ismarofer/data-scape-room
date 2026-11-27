import { useCallback, useEffect, useState } from "react";
import type { Lang } from "@codigo-alta/shared";
import { engineStarted, getEngine } from "./duck";
import { setTables as setCatalogForAi } from "./workContext";
import { InfoCard, lookup, useCatalog } from "./FileInfo";

export interface DbTable { schema: string; name: string; rows: number; cols: { name: string; type: string }[] }
const SAFE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Reads the in-browser DuckDB catalogue. It never starts the engine: it waits until a level tool has done it. */
export function useDbCatalog(): { tables: DbTable[]; refresh: () => void; started: boolean } {
  const [tables, setTables] = useState<DbTable[]>([]);
  const [started, setStarted] = useState(false);
  const refresh = useCallback(async () => {
    if (!engineStarted()) return;
    setStarted(true);
    try {
      const eng = await getEngine();
      const cols = await eng.query("select table_schema, table_name, column_name, data_type from information_schema.columns where table_schema not in ('information_schema','pg_catalog') order by table_schema, table_name, ordinal_position");
      const by = new Map<string, DbTable>();
      for (const c of cols) {
        if (!SAFE.test(c.table_schema) || !SAFE.test(c.table_name)) continue;
        const k = `${c.table_schema}.${c.table_name}`;
        if (!by.has(k)) by.set(k, { schema: c.table_schema, name: c.table_name, rows: 0, cols: [] });
        by.get(k)!.cols.push({ name: c.column_name, type: c.data_type });
      }
      const list = [...by.values()];
      if (list.length) {
        const counts = await eng.query(list.map((t) => `select '${t.schema}.${t.name}' as t, count(*) as n from "${t.schema}"."${t.name}"`).join(" union all "));
        for (const r of counts) { const t = by.get(r.t); if (t) t.rows = Number(r.n); }
      }
      setTables(list);
      setCatalogForAi(list.map((t) => ({ name: `${t.schema}.${t.name}`, rows: t.rows })));
    } catch { /* a tool is rebuilding tables: try again on the next tick */ }
  }, []);
  useEffect(() => { refresh(); const i = setInterval(refresh, 4000); return () => clearInterval(i); }, [refresh]);
  return { tables, refresh, started };
}

interface TreeProps { tables: DbTable[]; started: boolean; lang: Lang; active: string; closed: string[]; toggle: (k: string) => void; onOpen: (full: string) => void }

// Friendly names first: the technical schema name is not needed to play (it stays visible in the table tab).
const LAYERS: Record<string, { icon: string; order: number; es: string; gl: string; descEs: string; descGl: string }> = {
  raw: { icon: "🥉", order: 0, es: "Bronce · tal cual llegan", gl: "Bronce · tal cal chegan", descEs: "Los ficheros cargados, sin tocar", descGl: "Os ficheiros cargados, sen tocar" },
  staging: { icon: "🥈", order: 1, es: "Plata · datos limpios", gl: "Prata · datos limpos", descEs: "Fechas de verdad, sin repetidos y sin datos personales", descGl: "Datas de verdade, sen repetidos e sen datos persoais" },
  marts: { icon: "🥇", order: 2, es: "Oro · vuestro cálculo", gl: "Ouro · o voso cálculo", descEs: "Vuestro esquema en estrella: hechos (fct_) y dimensiones (dim_), más los episodios", descGl: "O voso esquema en estrela: feitos (fct_) e dimensións (dim_), máis os episodios" },
  canon: { icon: "🏅", order: 3, es: "Oro · modelo final", gl: "Ouro · modelo final", descEs: "El cálculo limpio de referencia (igual para todos)", descGl: "O cálculo limpo de referencia (igual para todos)" },
};

/** Sidebar tree: layer (bronze/silver/gold) > table (> columns). Clicking a table opens it in an editor tab. */
export function DbTree({ tables, started, lang, active, closed, toggle, onOpen }: TreeProps) {
  const gl = lang === "gl";
  const cat = useCatalog(lang);
  const schemas = [...new Set(tables.map((t) => t.schema))].sort((x, y) => (LAYERS[x]?.order ?? 9) - (LAYERS[y]?.order ?? 9));
  return (
    <>
      <details className="medal">
        <summary>{gl ? "Que son bronce, prata e ouro?" : "¿Qué son bronce, plata y oro?"}</summary>
        <p>{gl ? "Os datos organízanse en tres capas, de menos a máis traballados (a chamada «arquitectura medalla»). Cada capa constrúese a partir da anterior:" : "Los datos se organizan en tres capas, de menos a más trabajados (la llamada «arquitectura medallón»). Cada capa se construye a partir de la anterior:"}</p>
        <ul>
          <li>🥉 <b>{gl ? "Bronce (raw)" : "Bronce (raw)"}</b>: {gl ? "os datos tal cal chegan dos hospitais. Non se tocan: son a copia de seguridade para poder volver atrás." : "los datos tal cual llegan de los hospitales. No se tocan: son la copia de seguridad para poder volver atrás."}</li>
          <li>🥈 <b>{gl ? "Prata (staging)" : "Plata (staging)"}</b>: {gl ? "datos limpos: datas de verdade, valores unificados e sen duplicados." : "datos limpios: fechas de verdad, valores unificados y sin duplicados."}</li>
          <li>🥇 <b>{gl ? "Ouro (marts)" : "Oro (marts)"}</b>: {gl ? "táboas listas para medir e amosar (episodios, reingresos…)." : "tablas listas para medir y enseñar (episodios, reingresos…)."}</li>
        </ul>
      </details>
      {!tables.length ? (
        <p className="hint-small dbempty">{started ? (gl ? "Aínda non hai táboas." : "Aún no hay tablas.") : (gl ? "Aquí verás as táboas segundo as vaias creando (cargade os datos no nivel R1A)." : "Aquí veréis las tablas según las vayáis creando (cargad los datos en el nivel R1A).")}</p>
      ) : (
        <ul className="tree" role="tree" aria-label="Base de datos">
          {schemas.map((sc) => {
            const L = LAYERS[sc];
            return (
              <li key={sc} role="treeitem" aria-expanded={!closed.includes(`db:${sc}`)}>
                <button className="node folder" onClick={() => toggle(`db:${sc}`)} title={L ? (gl ? L.descGl : L.descEs) : sc}>
                  <span className="ico" aria-hidden="true">{closed.includes(`db:${sc}`) ? "▸" : "▾"}</span>
                  <span className="nm">{L ? `${L.icon} ${gl ? L.gl : L.es}` : sc}</span>
                </button>
                {L && !closed.includes(`db:${sc}`) && <small className="layerdesc">{gl ? L.descGl : L.descEs}</small>}
                {!closed.includes(`db:${sc}`) && (
                  <ul role="group">
                    {tables.filter((t) => t.schema === sc).map((t) => {
                      const full = `${t.schema}.${t.name}`;
                      const info = lookup(cat, `db:${full}`);
                      // no column list in the tree (it made it hard to read): the table tab explains every column
                      return (
                        <li key={full} role="treeitem" aria-selected={active === `db:${full}`}>
                          <div className="dbrow">
                            <button className={`node file ${active === `db:${full}` ? "sel" : ""}`} title={info ? `${info.label ?? t.name}: ${info.what}` : full} onClick={() => onOpen(full)}>
                              <span className="ico k-db" aria-hidden="true">▤</span><span className="nm">{t.name}{info?.label && <small className="tlabel"> · {info.label}</small>}</span><span className="cnt">{t.rows.toLocaleString(gl ? "gl" : "es")}</span>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** Editor tab: first rows of a table of the in-browser database. */
export function DbTableView({ full, lang }: { full: string; lang: Lang }) {
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");
  const gl = lang === "gl";
  const load = useCallback(async () => {
    const [sc, name] = full.split(".");
    if (!SAFE.test(sc) || !SAFE.test(name)) return;
    try {
      const eng = await getEngine();
      setRows(await eng.query(`select * from "${sc}"."${name}" limit 100`));
      setTotal(Number((await eng.query(`select count(*) as n from "${sc}"."${name}"`))[0].n));
      setErr("");
    } catch { setErr(gl ? "Esta táboa xa non existe (volve executar o nivel que a crea)." : "Esta tabla ya no existe (volved a ejecutar el nivel que la crea)."); }
  }, [full, gl]);
  useEffect(() => { load(); }, [load]);
  const cat = useCatalog(lang);
  if (err) return <p className="err viewpad">{err}</p>;
  if (!rows) return <p className="viewpad">…</p>;
  const info = lookup(cat, `db:${full}`);
  const colText = (k: string) => info?.cols.find((x) => x.name.split(" / ").includes(k))?.text;
  return (
    <div className="dbview">
      <InfoCard k={`db:${full}`} lang={lang} open />
      <div className="dbhead"><b>{full}</b> · {total.toLocaleString(gl ? "gl" : "es")} {gl ? "filas" : "filas"}{total > rows.length ? ` (${gl ? "amosando as primeiras" : "mostrando las primeras"} ${rows.length})` : ""} <button className="ghost" onClick={load}>↻ {gl ? "Actualizar" : "Actualizar"}</button></div>
      <div className="scroll big">
        <table className="prev">
          <thead><tr>{rows[0] ? Object.keys(rows[0]).map((k) => <th key={k} title={colText(k)} className={colText(k) ? "has-info" : ""}>{k}{colText(k) && <sup aria-hidden="true"> ⓘ</sup>}</th>) : <th>—</th>}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{v === null || v === undefined ? <i className="nul">NULL</i> : String(v)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
