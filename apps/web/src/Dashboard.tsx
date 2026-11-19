import { useEffect, useState } from "react";
import { CHART_TYPES, defaultChart, evaluateDashboard, type ChartSpec, type ChartType, type DashboardSpec, type Lang } from "@codigo-alta/shared";
import { ensureCanon, getEngine } from "./duck";
import { toolState } from "./kv";
import { setDraft } from "./workContext";

const store = {
  read: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  write: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const NAMES: Record<ChartType, { es: string; gl: string; icon: string }> = {
  bar_center: { es: "Barras por centro", gl: "Barras por centro", icon: "📊" },
  line_month: { es: "Línea mensual", gl: "Liña mensual", icon: "📈" },
  bar_age: { es: "Barras por tramo de edad", gl: "Barras por tramo de idade", icon: "👥" },
  table: { es: "Tabla ordenable", gl: "Táboa ordenable", icon: "🗒" },
  map_area: { es: "Mapa de áreas sanitarias", gl: "Mapa de áreas sanitarias", icon: "🗺" },
  kpi: { es: "Indicador KPI", gl: "Indicador KPI", icon: "🎯" },
};
const Q: Record<ChartType, (minN: boolean) => string> = {
  bar_center: (m) => `select organization_name as label, count(*) as n, 100.0 * sum(is_readmission_30d::int) / count(*) as rate from canon.fct_admission_clean group by 1 ${m ? "having count(*) >= 30" : ""}`,
  line_month: () => "select admit_month as label, count(*) as n, 100.0 * sum(is_readmission_30d::int) / count(*) as rate from canon.fct_admission_clean where admit_year >= 2022 group by 1 order by 1",
  bar_age: () => "select age_band as label, count(*) as n, 100.0 * sum(is_readmission_30d::int) / count(*) as rate from canon.fct_admission_clean where age_band <> 'n/d' group by 1 order by 1",
  table: (m) => `select organization_name as label, count(*) as n, 100.0 * sum(is_readmission_30d::int) / count(*) as rate from canon.fct_admission_clean group by 1 ${m ? "having count(*) >= 30" : ""}`,
  map_area: () => "select area_sanitaria as label, count(*) as n, 100.0 * sum(is_readmission_30d::int) / count(*) as rate from canon.fct_admission_clean group by 1",
  kpi: () => "select 'Global' as label, count(*) as n, 100.0 * sum(is_readmission_30d::int) / count(*) as rate from canon.fct_admission_clean",
};
const PAL = { single: ["#35d0ba"], accent: ["#35d0ba", "#ffb547"], rainbow: ["#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#46f0f0", "#f032e6", "#bcf60c"] };

function ChartView({ c }: { c: ChartSpec }) {
  const [data, setData] = useState<{ label: string; n: number; rate: number }[]>([]);
  useEffect(() => { (async () => { await ensureCanon(); setData((await (await getEngine()).query(Q[c.type](c.minN))).map((r) => ({ label: String(r.label), n: Number(r.n), rate: Number(r.rate) }))); })().catch(() => {}); }, [c.type, c.minN]);
  const rows = c.sort === "desc" ? [...data].sort((a, b) => b.rate - a.rate) : data;
  const colors = PAL[c.palette];
  const max = Math.max(1, ...rows.map((r) => r.rate)), min = Math.min(...rows.map((r) => r.rate));
  const lo = c.axisZero ? 0 : Math.max(0, min * 0.9);
  const scale = (v: number) => Math.max(2, ((v - lo) / (max - lo || 1)) * 100);
  if (c.type === "kpi") return <div className="kpi"><b>{rows[0] ? rows[0].rate.toFixed(1) : "…"} %</b>{c.showN && rows[0] && <small> n = {rows[0].n.toLocaleString()} altas</small>}</div>;
  if (c.type === "table") return <table className="prev"><thead><tr><th>Centro</th><th>Tasa %</th>{c.showN && <th>n</th>}</tr></thead><tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td><td>{r.rate.toFixed(1)}</td>{c.showN && <td>{r.n}</td>}</tr>)}</tbody></table>;
  if (c.type === "line_month") {
    const pts = rows.map((r, i) => `${(i / Math.max(1, rows.length - 1)) * 300},${70 - scale(r.rate) * 0.65}`).join(" ");
    return <svg viewBox="0 0 300 80" className="chart" role="img" aria-label={c.title}><polyline points={pts} fill="none" stroke={colors[0]} strokeWidth="2" />{c.showN && <text x="2" y="78" fontSize="6" fill="#9bb7b3">n/mes ≈ {rows.length ? Math.round(rows.reduce((a, r) => a + r.n, 0) / rows.length) : 0}</text>}</svg>;
  }
  return (
    <ul className={`bars ${c.threeD ? "three-d" : ""}`} aria-label={c.title}>
      {rows.map((r, i) => (
        <li key={r.label}><span className="bl">{r.label.replace("Hospital ", "H. ").slice(0, 26)}</span><span className="hbar" style={{ width: `${scale(r.rate)}%`, background: colors[(c.palette === "accent" ? (i === 0 && c.sort === "desc" ? 1 : 0) : i) % colors.length] }} /><span className="bv">{r.rate.toFixed(1)} %{c.showN && <small> (n={r.n})</small>}</span></li>
      ))}
    </ul>
  );
}

export function DashboardBuilder({ teamId, lang, review, onSubmit }: { teamId: string; lang: Lang; review: boolean; onSubmit: (spec: string) => Promise<void> }) {
  const es = lang === "es";
  const key = `ca_dash_${teamId}`;
  const [spec, setSpec] = useState<DashboardSpec>(() => { try { return JSON.parse(store.read(key) ?? ""); } catch { return { charts: [] }; } });
  const [sel, setSel] = useState(0);
  const [critic, setCritic] = useState<{ findings: { id: string; severity: string; text: string }[]; source: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { toolState.load(teamId, "dash").then((v) => { if (v) try { setSpec(JSON.parse(v)); } catch { /* ignore */ } }); }, [teamId]);
  useEffect(() => { toolState.save(teamId, "dash", JSON.stringify(spec)); }, [spec, teamId]);
  const up = (i: number, p: Partial<ChartSpec>) => setSpec({ charts: spec.charts.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  const add = (t: ChartType) => { if (spec.charts.length < 4) { setSpec({ charts: [...spec.charts, defaultChart(t)] }); setSel(spec.charts.length); } };
  const del = (i: number) => { setSpec({ charts: spec.charts.filter((_, j) => j !== i) }); setSel(0); };
  const ask = async () => { setBusy(true); try { setCritic(await (await fetch("/api/ai/critic", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId, spec, lang }) })).json()); } finally { setBusy(false); } };
  useEffect(() => { if (review && spec.charts.length) ask(); }, []); // eslint-disable-line
  const c = spec.charts[sel];
  const local = evaluateDashboard(spec);
  useEffect(() => { setDraft(review ? "r5c_critico" : "r5b_dashboard", JSON.stringify(spec), `Gráficos: ${spec.charts.map((x, i) => `${i + 1}) ${NAMES[x.type].es} «${x.title || "sin título"}» eje0=${x.axisZero} n=${x.showN} min30=${x.minN} orden=${x.sort} colores=${x.palette} dobleEje=${x.dualAxis} 3D=${x.threeD}`).join("; ") || "ninguno"}. Hallazgos del crítico ahora: ${local.map((f) => f.text.es).join(" | ") || "ninguno"}`); }, [spec, review]); // eslint-disable-line react-hooks/exhaustive-deps
  const chk = (label: string, k: "axisZero" | "showN" | "minN" | "dualAxis" | "threeD") => <label className="check"><input type="checkbox" checked={!!c[k]} onChange={(e) => up(sel, { [k]: e.target.checked })} /> {label}</label>;
  return (
    <div className="dash">
      <div className="palette" role="group" aria-label={es ? "Paleta de gráficos" : "Paleta de gráficos"}>
        {CHART_TYPES.map((t) => <button key={t} className="ghost" disabled={spec.charts.length >= 4} onClick={() => add(t)}>{NAMES[t].icon} {NAMES[t][lang]}</button>)}
        <small>{spec.charts.length}/4</small>
      </div>
      <div className="dash-grid">
        {spec.charts.map((ch, i) => (
          <section key={i} className={`panel ${i === sel ? "on" : ""}`} onClick={() => setSel(i)} aria-label={`${es ? "Gráfico" : "Gráfico"} ${i + 1}`}>
            <h4>{ch.title || (es ? "(sin título)" : "(sen título)")}</h4><ChartView c={ch} />
          </section>
        ))}
      </div>
      {c && (
        <fieldset className="cfg"><legend>{NAMES[c.type].icon} {es ? "Gráfico" : "Gráfico"} {sel + 1} — {NAMES[c.type][lang]}</legend>
          <label>{es ? "Título (que diga la conclusión)" : "Título (que diga a conclusión)"}<input value={c.title} onChange={(e) => up(sel, { title: e.target.value })} maxLength={120} /></label>
          <div className="opts">
            {chk(es ? "El eje empieza en cero" : "O eixe empeza en cero", "axisZero")}{chk(es ? "Mostrar n (nº de casos)" : "Amosar n (nº de casos)", "showN")}{chk(es ? "Solo centros con ≥ 30 altas" : "Só centros con ≥ 30 altas", "minN")}
            {chk(es ? "Doble eje" : "Dobre eixe", "dualAxis")}{chk("3D", "threeD")}
            <label>{es ? "Orden" : "Orde"}<select value={c.sort} onChange={(e) => up(sel, { sort: e.target.value as any })}><option value="none">{es ? "Sin orden" : "Sen orde"}</option><option value="desc">{es ? "De mayor a menor" : "De maior a menor"}</option></select></label>
            <label>{es ? "Colores" : "Cores"}<select value={c.palette} onChange={(e) => up(sel, { palette: e.target.value as any })}><option value="single">{es ? "Uno" : "Un"}</option><option value="accent">{es ? "Uno + énfasis" : "Un + énfase"}</option><option value="rainbow">{es ? "Muchos" : "Moitos"}</option></select></label>
          </div>
          <button className="ghost" onClick={() => del(sel)}>🗑 {es ? "Quitar gráfico" : "Quitar gráfico"}</button>
        </fieldset>
      )}
      {review && (
        <section className="critic" aria-live="polite"><h4>🤖 {es ? "Crítico de visualización" : "Crítico de visualización"} <small className="ai-tag">{es ? "Personaje con IA · puede equivocarse" : "Personaxe con IA · pode equivocarse"}</small></h4>
          <ul>{(critic?.findings ?? local.map((f) => ({ id: f.id, severity: f.severity, text: f.text[lang] }))).map((f) => <li key={f.id} className={f.severity}>{f.severity === "critical" ? "🔴" : f.severity === "warn" ? "🟡" : "🔵"} {f.text}</li>)}</ul>
          <button className="ghost" disabled={busy} onClick={ask}>{es ? "Pedir nueva revisión" : "Pedir nova revisión"}</button>
        </section>
      )}
      <button className="primary" disabled={spec.charts.length < 3} onClick={() => onSubmit(JSON.stringify(spec))}>{review ? (es ? "Entregar dashboard revisado" : "Entregar dashboard revisado") : (es ? "Pasar al crítico" : "Pasar ao crítico")}</button>
    </div>
  );
}
