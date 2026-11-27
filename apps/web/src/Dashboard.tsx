import { useEffect, useState } from "react";
import { CHART_KINDS, DIMENSIONS, MEASURES, chartTitle, defaultChart, evaluateDashboard, type ChartKind, type ChartSpec, type DashboardSpec, type Dimension, type Lang, type Measure } from "@codigo-alta/shared";
import { ensureCanon, getEngine } from "./duck";
import { toolState } from "./kv";
import { setDraft } from "./workContext";

type L2 = { es: string; gl: string };
const KIND: Record<ChartKind, L2 & { icon: string }> = {
  bar: { es: "Barras", gl: "Barras", icon: "📊" },
  line: { es: "Línea", gl: "Liña", icon: "📈" },
  area: { es: "Área (línea rellena)", gl: "Área (liña recheada)", icon: "⛰" },
  pie: { es: "Tarta (quesitos)", gl: "Torta (quesiños)", icon: "🥧" },
  donut: { es: "Anillo (dónut)", gl: "Anel (dónut)", icon: "🍩" },
  table: { es: "Tabla", gl: "Táboa", icon: "🗒" },
  kpi: { es: "Número grande (KPI)", gl: "Número grande (KPI)", icon: "🎯" },
};
const MEASURE: Record<Measure, L2> = {
  rate: { es: "Tasa de reingreso (%)", gl: "Taxa de reingreso (%)" },
  readmissions: { es: "Número de reingresos", gl: "Número de reingresos" },
  discharges: { es: "Número de altas", gl: "Número de altas" },
};
const DIM: Record<Dimension, L2> = {
  center: { es: "Centro", gl: "Centro" },
  age: { es: "Tramo de edad", gl: "Tramo de idade" },
  area: { es: "Área sanitaria", gl: "Área sanitaria" },
  month: { es: "Mes (2022 en adelante)", gl: "Mes (2022 en diante)" },
  year: { es: "Año", gl: "Ano" },
};
const COL: Record<Dimension, string> = { center: "organization_name", age: "age_band", area: "area_sanitaria", month: "admit_month", year: "admit_year" };
const VAL: Record<Measure, string> = {
  rate: "100.0 * sum(is_readmission_30d::int) / count(*)",
  readmissions: "sum(is_readmission_30d::int)",
  discharges: "count(*)",
};
const TIME: Dimension[] = ["month", "year"];
function sql(c: ChartSpec, minN: number): string {
  if (c.kind === "kpi") return `select 'Total' as label, count(*) as n, ${VAL[c.measure]} as v from canon.fct_admission_clean`;
  const where = c.by === "month" ? "where admit_year >= 2022" : c.by === "age" ? "where age_band <> 'n/d'" : "";
  return `select ${COL[c.by]}::varchar as label, count(*) as n, ${VAL[c.measure]} as v from canon.fct_admission_clean ${where} group by 1 ${c.minN ? `having count(*) >= ${minN}` : ""} order by 1`;
}
// DXC: True Blue as the base colour, Gold to highlight (blues on the edges, golds in the middle)
const PAL = { single: ["#4995FF"], accent: ["#4995FF", "#FFAE41"], rainbow: ["#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#46f0f0", "#f032e6", "#bcf60c"] };
const fmtV = (c: ChartSpec, v: number) => (c.measure === "rate" ? `${v.toFixed(1)} %` : Math.round(v).toLocaleString());

/** The minimum of discharges the team fixed in «KPI con sentido» (30 if they have not fixed one yet). */
export function useKpiMin(teamId: string): number {
  const [m, setM] = useState(30);
  useEffect(() => { toolState.load(teamId, "kpi_min").then((v) => { const n = Number(v); if (Number.isFinite(n) && n > 0) setM(n); }); }, [teamId]);
  return m;
}

export function ChartView({ c, minN }: { c: ChartSpec; minN: number }) {
  const [data, setData] = useState<{ label: string; n: number; v: number }[]>([]);
  const q = sql(c, minN);
  useEffect(() => { (async () => { await ensureCanon(); setData((await (await getEngine()).query(q)).map((r) => ({ label: String(r.label), n: Number(r.n), v: Number(r.v) }))); })().catch(() => setData([])); }, [q]);
  const rows = c.sort === "desc" && !TIME.includes(c.by) ? [...data].sort((a, b) => b.v - a.v) : data;
  const colors = PAL[c.palette];
  const max = Math.max(1e-9, ...rows.map((r) => r.v));
  const pct = (v: number) => Math.max(1, (v / max) * 100); // the value axis always starts at zero
  if (c.kind === "kpi") return <div className="kpi"><b>{rows[0] ? fmtV(c, rows[0].v) : "…"}</b>{c.showN && rows[0] && <small> n = {rows[0].n.toLocaleString()} altas</small>}</div>;
  if (c.kind === "table") return <table className="prev"><thead><tr><th>{DIM[c.by].es}</th><th>{MEASURE[c.measure].es}</th>{c.showN && <th>n</th>}</tr></thead><tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td><td>{fmtV(c, r.v)}</td>{c.showN && <td>{r.n}</td>}</tr>)}</tbody></table>;
  if (c.kind === "pie" || c.kind === "donut") {
    // drawn as it would really look, so the team can see why it is hard to read
    const tot = rows.reduce((s, r) => s + Math.max(0, r.v), 0) || 1;
    let a0 = -Math.PI / 2;
    const arcs = rows.map((r, i) => {
      const a1 = a0 + (2 * Math.PI * Math.max(0, r.v)) / tot, big = a1 - a0 > Math.PI ? 1 : 0;
      const d = `M 50 42 L ${50 + 38 * Math.cos(a0)} ${42 + 38 * Math.sin(a0)} A 38 38 0 ${big} 1 ${50 + 38 * Math.cos(a1)} ${42 + 38 * Math.sin(a1)} Z`;
      a0 = a1;
      return <path key={r.label} d={d} fill={colors[i % colors.length]} stroke="var(--panel, #fff)" strokeWidth="0.6"><title>{`${r.label}: ${fmtV(c, r.v)}`}</title></path>;
    });
    return (
      <svg viewBox="0 0 300 84" className="chart" role="img" aria-label={chartTitle(c)}>
        {arcs}
        {c.kind === "donut" && <circle cx="50" cy="42" r="19" fill="var(--panel, #fff)" />}
        {rows.slice(0, 9).map((r, i) => <text key={r.label} x="100" y={8 + i * 8.6} fontSize="6.2" fill="currentColor"><tspan fill={colors[i % colors.length]}>■</tspan> {r.label.replace("Hospital ", "H. ").slice(0, 30)}{c.showN ? ` (n=${r.n})` : ""}</text>)}
      </svg>
    );
  }
  if (c.kind === "line" || c.kind === "area") {
    const pts = rows.map((r, i) => `${(i / Math.max(1, rows.length - 1)) * 300},${72 - pct(r.v) * 0.66}`).join(" ");
    return (
      <svg viewBox="0 0 300 84" className="chart" role="img" aria-label={chartTitle(c)}>
        <line x1="0" y1="72" x2="300" y2="72" stroke="currentColor" strokeOpacity="0.3" />
        {c.kind === "area" && rows.length > 0 && <polygon points={`0,72 ${pts} 300,72`} fill={colors[0]} fillOpacity="0.35" />}
        <polyline points={pts} fill="none" stroke={colors[0]} strokeWidth="2" />
        <text x="2" y="82" fontSize="6" fill="currentColor" opacity="0.7">{rows[0]?.label} … {rows[rows.length - 1]?.label} · máx. {rows.length ? fmtV(c, max) : ""}</text>
      </svg>
    );
  }
  return (
    <ul className="bars" aria-label={chartTitle(c)}>
      {rows.map((r, i) => (
        <li key={r.label}><span className="bl">{r.label.replace("Hospital ", "H. ").slice(0, 26)}</span><span className="hbar" style={{ width: `${pct(r.v)}%`, background: colors[(c.palette === "accent" ? (i === 0 && c.sort === "desc" ? 1 : 0) : i) % colors.length] }} /><span className="bv">{fmtV(c, r.v)}{c.showN && <small> (n={r.n})</small>}</span></li>
      ))}
    </ul>
  );
}
/** Specs saved by the old builder (fixed chart types) are dropped instead of crashing the new one. */
const norm = (d: any): DashboardSpec => ({ charts: Array.isArray(d?.charts) ? d.charts.filter((c: any) => CHART_KINDS.includes(c?.kind)) : [] });

/** `initial` + `readOnly`: show a delivered dashboard of a solved level (nothing is saved and the AI critic is not called). */
export function DashboardBuilder({ teamId, lang, review, onSubmit, initial, readOnly }: { teamId: string; lang: Lang; review: boolean; onSubmit: (spec: string) => Promise<unknown>; initial?: string; readOnly?: boolean }) {
  const es = lang === "es";
  const [spec, setSpec] = useState<DashboardSpec>({ charts: [] });
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState(0);
  const [critic, setCritic] = useState<{ findings: { id: string; severity: string; text: string }[]; source: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const minN = useKpiMin(teamId);
  useEffect(() => {
    if (initial) { try { setSpec(norm(JSON.parse(initial))); return; } catch { /* older answer: what is saved */ } }
    toolState.load(teamId, "dash").then((v) => { if (v) try { setSpec(norm(JSON.parse(v))); } catch { /* ignore */ } setLoaded(true); });
  }, [teamId, initial]);
  useEffect(() => { if (loaded && !readOnly) toolState.save(teamId, "dash", JSON.stringify(spec)); }, [spec, teamId, loaded, readOnly]);
  const up = (i: number, p: Partial<ChartSpec>) => { setSpec({ charts: spec.charts.map((c, j) => (j === i ? { ...c, ...p } : c)) }); setCritic(null); };
  const add = () => { if (spec.charts.length < 4) { setSpec({ charts: [...spec.charts, defaultChart()] }); setSel(spec.charts.length); setCritic(null); } };
  const del = (i: number) => { setSpec({ charts: spec.charts.filter((_, j) => j !== i) }); setSel(0); setCritic(null); };
  const ask = async () => { setBusy(true); try { setCritic(await (await fetch("/api/ai/critic", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId, spec, lang }) })).json()); } finally { setBusy(false); } };
  useEffect(() => { if (review && loaded && spec.charts.length && !readOnly) ask(); }, [loaded]); // eslint-disable-line
  const c = spec.charts[sel];
  const local = evaluateDashboard(spec);
  const reds = local.filter((f) => f.severity === "critical").length, yellows = local.filter((f) => f.severity === "warn").length;
  useEffect(() => { setDraft(review ? "r5c_critico" : "r5b_dashboard", JSON.stringify(spec), `Gráficos: ${spec.charts.map((x, i) => `${i + 1}) ${KIND[x.kind].es} de ${MEASURE[x.measure].es}${x.kind === "kpi" ? "" : ` por ${DIM[x.by].es}`} «${chartTitle(x)}» n=${x.showN} mínimo=${x.minN} orden=${x.sort} colores=${x.palette}`).join("; ") || "ninguno"}. Revisión ahora: ${local.map((f) => `[${f.severity}] ${f.text.es}`).join(" | ") || "nada"}`); }, [spec, review]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = critic?.findings ?? local.map((f) => ({ id: f.id, severity: f.severity, text: f.text[lang] }));
  const chartBad = (i: number) => local.filter((f) => f.chart === i).reduce((w, f) => (f.severity === "critical" ? "critical" : w === "critical" ? w : f.severity === "warn" ? "warn" : w), "" as string);
  return (
    <div className="dash">
      <div className="palette" role="group" aria-label={es ? "Gráficos" : "Gráficos"}>
        <button className="ghost" disabled={spec.charts.length >= 4} onClick={add}>＋ {es ? "Añadir gráfico" : "Engadir gráfico"}</button>
        <small>{spec.charts.length}/4 · {es ? "entre 3 y 4" : "entre 3 e 4"}</small>
      </div>
      <div className="dash-grid">
        {spec.charts.map((ch, i) => (
          <section key={i} className={`panel ${i === sel ? "on" : ""} ${review ? `f-${chartBad(i)}` : ""}`} onClick={() => setSel(i)} aria-label={`${es ? "Gráfico" : "Gráfico"} ${i + 1}`}>
            <h4>{i + 1}. {chartTitle(ch, lang)}</h4><ChartView c={ch} minN={minN} />
          </section>
        ))}
      </div>
      {c && (
        <fieldset className="cfg"><legend>{KIND[c.kind].icon} {es ? "Gráfico" : "Gráfico"} {sel + 1}</legend>
          <div className="opts">
            <label>{es ? "Tipo de gráfico" : "Tipo de gráfico"}<select value={c.kind} onChange={(e) => up(sel, { kind: e.target.value as ChartKind })}>{CHART_KINDS.map((k) => <option key={k} value={k}>{KIND[k].icon} {KIND[k][lang]}</option>)}</select></label>
            <label>{es ? "Qué dato se muestra" : "Que dato se amosa"}<select value={c.measure} onChange={(e) => up(sel, { measure: e.target.value as Measure })}>{MEASURES.map((m) => <option key={m} value={m}>{MEASURE[m][lang]}</option>)}</select></label>
            {c.kind !== "kpi" && <label>{es ? "Repartido por (eje)" : "Repartido por (eixe)"}<select value={c.by} onChange={(e) => up(sel, { by: e.target.value as Dimension })}>{DIMENSIONS.map((d) => <option key={d} value={d}>{DIM[d][lang]}</option>)}</select></label>}
          </div>
          <p className="hint-small">{es ? "El título se pone solo según lo que muestra el gráfico." : "O título ponse só segundo o que amosa o gráfico."}</p>
          <div className="opts">
            <label className="check"><input type="checkbox" checked={c.showN} onChange={(e) => up(sel, { showN: e.target.checked })} /> {es ? "Mostrar n (altas detrás de cada dato)" : "Amosar n (altas detrás de cada dato)"}</label>
            {c.kind !== "kpi" && <label className="check"><input type="checkbox" checked={c.minN} onChange={(e) => up(sel, { minN: e.target.checked })} /> {es ? `Aplicar vuestro mínimo de altas (≥ ${minN})` : `Aplicar o voso mínimo de altas (≥ ${minN})`}</label>}
            {c.kind !== "kpi" && !TIME.includes(c.by) && <label>{es ? "Orden" : "Orde"}<select value={c.sort} onChange={(e) => up(sel, { sort: e.target.value as any })}><option value="none">{es ? "Alfabético" : "Alfabético"}</option><option value="desc">{es ? "De mayor a menor" : "De maior a menor"}</option></select></label>}
            <label>{es ? "Colores" : "Cores"}<select value={c.palette} onChange={(e) => up(sel, { palette: e.target.value as any })}><option value="single">{es ? "Uno" : "Un"}</option><option value="accent">{es ? "Uno + énfasis" : "Un + énfase"}</option><option value="rainbow">{es ? "Muchos" : "Moitos"}</option></select></label>
          </div>
          <p className="hint-small">{es ? "Las barras y las líneas empiezan siempre en cero: así no se exageran las diferencias." : "As barras e as liñas empezan sempre en cero: así non se esaxeran as diferenzas."}</p>
          <button className="ghost" onClick={() => del(sel)}>🗑 {es ? "Quitar gráfico" : "Quitar gráfico"}</button>
        </fieldset>
      )}
      {review && (
        <section className="critic" aria-live="polite"><h4>🤖 {es ? "Crítico de visualización" : "Crítico de visualización"} <small className="ai-tag">{es ? "Personaje con IA · puede equivocarse" : "Personaxe con IA · pode equivocarse"}</small></h4>
          <p className="hint-small">{es ? "🔴 engaña: hay que arreglarlo para seguir · 🟡 mejorable: podéis seguir, pero ganaréis menos confianza · 🔵 sugerencia." : "🔴 engana: hai que arranxalo para seguir · 🟡 mellorable: podedes seguir, pero gañaredes menos confianza · 🔵 suxestión."}</p>
          {shown.length === 0 ? <p className="ok">✔ {es ? "Nada que objetar." : "Nada que obxectar."}</p> : <ul>{shown.map((f) => <li key={f.id} className={f.severity}>{f.severity === "critical" ? "🔴" : f.severity === "warn" ? "🟡" : "🔵"} {f.text}</li>)}</ul>}
          <button className="ghost" disabled={busy} onClick={ask}>{es ? "Pedir nueva revisión" : "Pedir nova revisión"}</button>
        </section>
      )}
      {review
        ? <button className="primary" disabled={spec.charts.length < 3 || reds > 0} onClick={() => onSubmit(JSON.stringify(spec))}>{reds > 0 ? (es ? `Arreglad lo rojo (${reds}) para entregar` : `Arranxade o vermello (${reds}) para entregar`) : yellows > 0 ? (es ? `Entregar con ${yellows} aviso(s) 🟡` : `Entregar con ${yellows} aviso(s) 🟡`) : (es ? "Entregar dashboard revisado" : "Entregar dashboard revisado")}</button>
        : <button className="primary" disabled={spec.charts.length < 3} onClick={() => onSubmit(JSON.stringify(spec))}>{es ? "Pasar al crítico" : "Pasar ao crítico"}</button>}
    </div>
  );
}
