import { useEffect, useState } from "react";
import { addEdge, Background, Controls, Handle, Position, ReactFlow, useEdgesState, useNodesState, type Connection, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { guardSql, type Lang } from "@codigo-alta/shared";
import { ensureCanon, getEngine } from "./duck";
import { restoreRaw } from "./raw";
import { setDraft } from "./workContext";

const tx = (t: any, lang: Lang) => (typeof t === "string" ? t : (t?.[lang] ?? t?.es ?? ""));
type Props = { lang: Lang; onSubmit: (report: string) => Promise<void> };

// ------------------------------------------------------------------ R3A protocol
export function ProtocolForm({ lang, onSubmit }: Props) {
  const [p, setP] = useState<any>(null);
  const [ans, setAns] = useState<Record<string, string>>({});
  useEffect(() => { fetch("/api/protocol").then((r) => r.json()).then(setP); }, []);
  if (!p) return <p>…</p>;
  const ready = p.questions.every((q: any) => ans[q.id]);
  setDraft("r3a_protocolo", p.questions.filter((q: any) => ans[q.id]).map((q: any) => `${q.id}=${ans[q.id]}`).join(";"), `Respuestas elegidas: ${p.questions.map((q: any) => `${tx(q.label, "es")} → ${tx(q.options.find((o: any) => o.id === ans[q.id])?.label, "es") || "(sin elegir)"}`).join("; ")}`);
  return (
    <div className="protocol">
      <article className="paper"><h3>📄 {tx(p.title, lang)}</h3><pre>{tx(p.body, lang)}</pre></article>
      {p.questions.map((q: any) => (
        <label key={q.id}>{tx(q.label, lang)}
          <select value={ans[q.id] ?? ""} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })}>
            <option value="">—</option>{q.options.map((o: any) => <option key={o.id} value={o.id}>{tx(o.label, lang)}</option>)}
          </select>
        </label>
      ))}
      <button className="primary" disabled={!ready} onClick={() => onSubmit(p.questions.map((q: any) => `${q.id}=${ans[q.id]}`).join(";"))}>{lang === "es" ? "Configurar el modelo" : "Configurar o modelo"}</button>
    </div>
  );
}

// ------------------------------------------------------------------ R3B star schema canvas
type TableNode = Node<{ name: string; kind: "dim" | "fact" | ""; setKind: (k: "dim" | "fact" | "") => void; lang: Lang }>;
function TableCard({ data }: NodeProps<TableNode>) {
  return (
    <div className={`tbl ${data.kind}`}>
      <Handle type="target" position={Position.Top} /><b>{data.name}</b>
      <select className="nodrag" aria-label={`${data.name}: ${data.lang === "es" ? "tipo" : "tipo"}`} value={data.kind} onChange={(e) => data.setKind(e.target.value as any)}>
        <option value="">?</option><option value="fact">{data.lang === "es" ? "Hecho" : "Feito"}</option><option value="dim">{data.lang === "es" ? "Dimensión" : "Dimensión"}</option>
      </select>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const TABLES = ["dim_patient", "dim_hospital", "dim_date", "fct_admission", "fct_condition"];
export function StarCanvas({ lang, onSubmit }: Props) {
  const es = lang === "es";
  const [kinds, setKinds] = useState<Record<string, "dim" | "fact" | "">>({});
  const mk = (): TableNode[] => TABLES.map((n, i) => ({ id: n, type: "table", position: { x: 40 + (i % 3) * 230, y: i < 3 ? 20 : 190 }, data: { name: n, kind: "", setKind: () => {}, lang } }));
  const [nodes, setNodes, onNodesChange] = useNodesState<TableNode>(mk());
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  useEffect(() => { setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, kind: kinds[n.id] ?? "", lang, setKind: (k) => setKinds((s) => ({ ...s, [n.id]: k })) } }))); }, [kinds, lang, setNodes]);
  const onConnect = (c: Connection) => setEdges((es_) => addEdge({ ...c, markerEnd: { type: "arrowclosed" as any } }, es_));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const issues: string[] = [];
  const kind = (id: string) => kinds[id] ?? "";
  if (TABLES.some((t) => !kind(t))) issues.push(es ? "Marca cada tabla como hecho o dimensión." : "Marca cada táboa como feito ou dimensión.");
  if (edges.some((e) => kind(e.source) === "dim" && kind(e.target) === "dim")) issues.push(es ? "Las dimensiones no se conectan entre sí." : "As dimensións non se conectan entre si.");
  if (edges.some((e) => kind(e.source) === "dim" && kind(e.target) === "fact")) issues.push(es ? "Las flechas salen del hecho hacia la dimensión." : "As frechas saen do feito cara á dimensión.");
  if (edges.some((e) => kind(e.source) === "fact" && kind(e.target) === "fact")) issues.push(es ? "Un hecho no se une a otro hecho: comparten dimensiones." : "Un feito non se une a outro feito: comparten dimensións.");
  const report = `types:${[...TABLES].sort().map((t) => `${t}=${kind(t)}`).join(",")}|edges:${edges.map((e) => `${e.source}>${e.target}`).sort().join(",")}`;
  useEffect(() => { setDraft("r3b_estrella", report, `Tipos: ${TABLES.map((t) => `${t}=${kind(t) === "fact" ? "hecho" : kind(t) === "dim" ? "dimensión" : "sin elegir"}`).join(", ")}. Uniones: ${edges.map((e) => `${e.source} → ${e.target}`).join(", ") || "ninguna"}.`); }, [report]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <p className="hint-small">{es ? "Arrastra desde el punto inferior de un hecho hasta el punto superior de una dimensión. Con teclado: Tab para moverte por las tablas y las flechas para elegir tipo." : "Arrastra desde o punto inferior dun feito ata o punto superior dunha dimensión."}</p>
      <div className="flow"><ReactFlow nodes={nodes} edges={edges} nodeTypes={{ table: TableCard }} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView proOptions={{ hideAttribution: true }}><Background /><Controls showInteractive={false} /></ReactFlow></div>
      <div className="row" role="group" aria-label={es ? "Unir con teclado" : "Unir con teclado"}>
        <label>{es ? "Desde" : "Desde"}<select value={from} onChange={(e) => setFrom(e.target.value)}><option value="">—</option>{TABLES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
        <label>{es ? "Hasta" : "Ata"}<select value={to} onChange={(e) => setTo(e.target.value)}><option value="">—</option>{TABLES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
        <button className="ghost" disabled={!from || !to || from === to || edges.some((e) => e.source === from && e.target === to)} onClick={() => { setEdges((x) => [...x, { id: `${from}>${to}`, source: from, target: to, markerEnd: { type: "arrowclosed" as any } }]); setFrom(""); setTo(""); }}>{es ? "Unir" : "Unir"}</button>
        <button className="ghost" disabled={edges.length === 0} onClick={() => setEdges([])}>{es ? "Borrar uniones" : "Borrar unións"}</button>
      </div>
      <ul className="err">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
      <button className="primary" disabled={issues.length > 0 || edges.length === 0} onClick={() => onSubmit(report)}>{es ? "Comprobar esquema" : "Comprobar esquema"}</button>
    </div>
  );
}

// ------------------------------------------------------------------ R4A evidence board + R4C verdict + R4D counts
const DETECTORS = [
  { id: "negative_stay", icon: "⏪", es: "Estancias negativas (alta antes del ingreso)", gl: "Estadías negativas (alta antes do ingreso)", sql: "select count(*) as registros, min(ts)::date as desde, max(ts)::date as hasta from canon.anomalies where kind = 'negative_stay'" },
  { id: "post_mortem", icon: "🕯", es: "Encuentros posteriores al fallecimiento", gl: "Encontros posteriores ao falecemento", sql: "select count(*) as registros, count(distinct patient_key) as pacientes from canon.anomalies where kind = 'post_mortem'" },
  { id: "frag_h3", icon: "🧩", es: "Altas y reingresos del mismo día (fragmentación)", gl: "Altas e reingresos do mesmo día (fragmentación)", sql: "select count(*) as registros, count(distinct organization_id) as centros, min(ts)::date as desde from canon.anomalies where kind = 'frag_h3'" },
];
function useDetectors() {
  const [rows, setRows] = useState<Record<string, Record<string, any>>>({});
  useEffect(() => {
    (async () => { await ensureCanon(); const eng = await getEngine(); const o: Record<string, Record<string, any>> = {}; for (const d of DETECTORS) o[d.id] = (await eng.query(d.sql))[0]; setRows(o); })().catch((e) => setRows({ _error: { error: String(e?.message ?? e).slice(0, 200) } }));
  }, []);
  return rows;
}
const show = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "number" && v > 1e11 ? new Date(v).toISOString().slice(0, 10) : String(v));
function DetectorCards({ rows, lang, children }: { rows: Record<string, Record<string, any>>; lang: Lang; children?: (id: string) => React.ReactNode }) {
  return (
    <div className="detectors">
      {DETECTORS.map((d) => (
        <article key={d.id} className="det"><h4>{d.icon} {lang === "es" ? d.es : d.gl}</h4>
          <p>{rows._error ? <span className="err">{String(rows._error.error)}</span> : rows[d.id] ? Object.entries(rows[d.id]).map(([k, v]) => <span key={k}><small>{k}</small> <b>{show(v)}</b>{"  "}</span>) : "…"}</p>
          {children?.(d.id)}
        </article>
      ))}
    </div>
  );
}
export function EvidenceBoard({ lang, onSubmit }: Props) {
  const rows = useDetectors();
  const [c, setC] = useState<Record<string, string>>({});
  const causes = [["capture", lang === "es" ? "Error de captura (al teclear)" : "Erro de captura (ao teclear)"], ["migration", lang === "es" ? "Error de migración (cambio de sistema)" : "Erro de migración (cambio de sistema)"], ["late_death", lang === "es" ? "Registro tardío de fallecimiento" : "Rexistro tardío de falecemento"]];
  setDraft("r4a_pruebas", DETECTORS.filter((d) => c[d.id]).map((d) => `${d.id}=${c[d.id]}`).join(";"), `Causas elegidas: ${DETECTORS.map((d) => `${d.es} → ${causes.find(([v]) => v === c[d.id])?.[1] ?? "(sin elegir)"}`).join("; ")}`);
  return (
    <div>
      <DetectorCards rows={rows} lang={lang}>{(id) => (
        <label>{lang === "es" ? "Causa probable" : "Causa probable"}<select value={c[id] ?? ""} onChange={(e) => setC({ ...c, [id]: e.target.value })}><option value="">—</option>{causes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      )}</DetectorCards>
      <button className="primary" disabled={DETECTORS.some((d) => !c[d.id])} onClick={() => onSubmit([...DETECTORS.map((d) => d.id)].sort().map((id) => `${id}=${c[id]}`).join(";"))}>🧵 {lang === "es" ? "Clavar en el tablero" : "Cravar no taboleiro"}</button>
    </div>
  );
}
export function VerdictForm({ lang, onSubmit }: Props) {
  const rows = useDetectors();
  const [c, setC] = useState<Record<string, string>>({});
  setDraft("r4c_veredicto", DETECTORS.filter((d) => c[d.id]).map((d) => `${d.id}=${c[d.id]}`).join(";"), `Tratamientos elegidos: ${DETECTORS.map((d) => `${d.es} → ${c[d.id] ?? "(sin elegir)"}`).join("; ")}`);
  const opts = [["fix_rule", lang === "es" ? "Corregir con una regla" : "Corrixir cunha regra"], ["exclude_document", lang === "es" ? "Excluir y documentar" : "Excluír e documentar"], ["exclude_escalate", lang === "es" ? "Excluir y escalar al hospital" : "Excluír e escalar ao hospital"], ["document", lang === "es" ? "Ya cubierto por la fusión de episodios: documentar" : "Xa cuberto pola fusión de episodios: documentar"]];
  return (
    <div>
      <DetectorCards rows={rows} lang={lang}>{(id) => (
        <label>{lang === "es" ? "Tratamiento" : "Tratamento"}<select value={c[id] ?? ""} onChange={(e) => setC({ ...c, [id]: e.target.value })}><option value="">—</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      )}</DetectorCards>
      <button className="primary" disabled={DETECTORS.some((d) => !c[d.id])} onClick={() => onSubmit([...DETECTORS.map((d) => d.id)].sort().map((id) => `${id}=${c[id]}`).join(";"))}>{lang === "es" ? "Dictar veredicto" : "Ditar veredicto"}</button>
    </div>
  );
}
export function EvidenceCounts({ lang }: { lang: Lang }) {
  const rows = useDetectors();
  return <DetectorCards rows={rows} lang={lang} />;
}

// ------------------------------------------------------------------ R5A KPI form
export function KpiForm({ lang, onSubmit }: Props) {
  const es = lang === "es";
  const [a, setA] = useState<Record<string, string>>({});
  const Q: { id: string; label: string; o: [string, string][] }[] = [
    { id: "kpi", label: es ? "¿Cómo se calcula la tasa?" : "Como se calcula a taxa?", o: [["readmit_over_discharges", es ? "Reingresos a 30 días / altas del periodo" : "Reingresos a 30 días / altas do período"], ["readmit_over_patients", es ? "Reingresos / pacientes del hospital" : "Reingresos / pacientes do hospital"], ["readmit_count", es ? "Solo el número de reingresos" : "Só o número de reingresos"]] },
    { id: "min_n", label: es ? "¿Desde cuántas altas se publica la tasa de un centro?" : "Desde cantas altas se publica a taxa dun centro?", o: [["none", es ? "Siempre, sin mínimo" : "Sempre, sen mínimo"], ["n10", es ? "10 altas" : "10 altas"], ["n30", es ? "30 altas" : "30 altas"], ["n1000", es ? "1.000 altas" : "1.000 altas"]] },
    { id: "small_center", label: es ? "Clínica Illas Cíes (3 ingresos, 100 %): ¿qué hacemos?" : "Clínica Illas Cíes (3 ingresos, 100 %): que facemos?", o: [["show", es ? "Mostrarla como las demás" : "Amosala como as demais"], ["hide", es ? "Ocultarla sin decir nada" : "Agochala sen dicir nada"], ["pool", es ? "Agruparla con otros centros pequeños" : "Agrupala con outros centros pequenos"], ["warn", es ? "Mostrarla con un aviso de pocos casos" : "Amosala cun aviso de poucos casos"]] },
  ];
  setDraft("r5a_kpi", Q.filter((q) => a[q.id]).map((q) => `${q.id}=${a[q.id]}`).join(";"), `Indicador: ${Q.map((q) => `${q.label} → ${q.o.find(([v]) => v === a[q.id])?.[1] ?? "(sin elegir)"}`).join("; ")}`);
  return (
    <div>
      {Q.map((q) => <label key={q.id}>{q.label}<select value={a[q.id] ?? ""} onChange={(e) => setA({ ...a, [q.id]: e.target.value })}><option value="">—</option>{q.o.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>)}
      <button className="primary" disabled={Q.some((q) => !a[q.id])} onClick={() => onSubmit(`kpi=${a.kpi};min_n=${a.min_n};small_center=${a.small_center}`)}>{es ? "Fijar el indicador" : "Fixar o indicador"}</button>
    </div>
  );
}

// ------------------------------------------------------------------ quick checks (R3C / R5D)
export function QuickChecks({ teamId, lang, lockId }: { teamId: string; lang: Lang; lockId: string }) {
  const es = lang === "es";
  const presets = lockId === "r3c_modelo"
    ? [[es ? "Episodios en el modelo" : "Episodios no modelo", "select count(*) as episodios from marts.fct_admission"], [es ? "Episodios marcados como reingreso" : "Episodios marcados como reingreso", "select count(*) filter (where is_readmission_30d) as reingresos, count(*) as episodios from marts.fct_admission"], [es ? "Reingresos por centro" : "Reingresos por centro", "select organization_id, count(*) as altas, count(*) filter (where is_readmission_30d) as reingresos from marts.fct_admission group by 1 order by 1"]]
    : [[es ? "Tasa por centro (modelo limpio)" : "Taxa por centro (modelo limpo)", "select organization_name as centro, count(*) as altas, sum(is_readmission_30d::int) as reingresos, round(100.0 * sum(is_readmission_30d::int) / count(*), 1) as tasa from canon.fct_admission_clean group by 1 order by 4 desc"], [es ? "Solo centros con 30 o más altas" : "Só centros con 30 ou máis altas", "select organization_name as centro, count(*) as altas, round(100.0 * sum(is_readmission_30d::int) / count(*), 1) as tasa from canon.fct_admission_clean group by 1 having count(*) >= 30 order by 3 desc"]];
  const [out, setOut] = useState<Record<string, any>[] | string>([]);
  const [sql, setSql] = useState("");
  const run = async (q: string) => {
    try {
      const g = guardSql(q); if (!g.ok) throw new Error(g.reason);
      if (q.includes("canon.")) await ensureCanon(); else if (!(await restoreRaw(teamId))) throw new Error(es ? "Primero ejecuta los modelos." : "Primeiro executa os modelos.");
      setOut((await (await getEngine()).query(q)).slice(0, 20));
    } catch (e) { setOut(String((e as Error).message).includes("does not exist") ? (es ? "Esa tabla aún no existe: ejecuta los modelos primero." : "Esa táboa aínda non existe: executa os modelos primeiro.") : String((e as Error).message)); }
  };
  return (
    <div className="quick">
      <div className="row">{presets.map(([l, q]) => <button key={l} className="ghost" onClick={() => run(q)}>{l}</button>)}</div>
      <div className="row"><input aria-label="SQL" value={sql} onChange={(e) => setSql(e.target.value)} placeholder="select …" style={{ flex: 1 }} /><button className="ghost" onClick={() => run(sql)}>▶</button></div>
      {typeof out === "string" ? <p className="err">{out}</p> : out.length > 0 && <div className="scroll"><table className="prev"><thead><tr>{Object.keys(out[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead><tbody>{out.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>)}</tbody></table></div>}
    </div>
  );
}
