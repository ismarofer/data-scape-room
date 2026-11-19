import { useEffect, useMemo, useState } from "react";
import { ML_FEATURES, parseMlCsv, simulateWeeks, sensitivityByGroup, train, WEEKLY_CALL_CAPACITY, WEEKLY_DISCHARGES, type Lang, type MlFeature, type MlRow, type TrainResult } from "@codigo-alta/shared";
import { toolState } from "./kv";
import { setDraft } from "./workContext";

// ---------- shared: dataset + saved choices ----------
let rowsPromise: Promise<MlRow[]> | null = null;
const loadRows = () => (rowsPromise ??= fetch("/data/ml/ml_features.csv").then((r) => { if (!r.ok) throw new Error("ml"); return r.text(); }).then(parseMlCsv).catch((e) => { rowsPromise = null; throw e; }));
const trained = new Map<string, TrainResult>();
const trainCached = (rows: MlRow[], feats: MlFeature[]) => { const k = [...feats].sort().join(","); if (!trained.has(k)) trained.set(k, train(rows, [...feats].sort() as MlFeature[])); return trained.get(k)!; };
interface Saved { features: MlFeature[]; threshold?: number }
const DEFAULT_CLEAN: MlFeature[] = ["edad", "cronicas", "estancia", "previos", "centro", "sexo"];
function useMlData(teamId: string) {
  const [rows, setRows] = useState<MlRow[] | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { loadRows().then(setRows).catch(() => setErr(true)); toolState.load(teamId, "ml").then((v) => { try { setSaved(v ? JSON.parse(v) : {}); } catch { setSaved({} as Saved); } }); }, [teamId]);
  const save = (patch: Partial<Saved>) => setSaved((s) => { const n = { features: s?.features ?? DEFAULT_CLEAN, ...(s ?? {}), ...patch }; toolState.save(teamId, "ml", JSON.stringify(n)); return n; });
  return { rows, saved, save, err };
}

const VAR_TEXT: Record<MlFeature, { es: string; gl: string; d_es: string; d_gl: string }> = {
  edad: { es: "Edad (tramo)", gl: "Idade (tramo)", d_es: "El tramo de edad del paciente (0-17, 18-44, 45-64, 65-79, 80 o más).", d_gl: "O tramo de idade do paciente (0-17, 18-44, 45-64, 65-79, 80 ou máis)." },
  cronicas: { es: "Nº de condiciones", gl: "Nº de condicións", d_es: "Cuántas condiciones o diagnósticos tiene registrados el paciente hasta el alta.", d_gl: "Cantas condicións ou diagnósticos ten rexistrados o paciente ata a alta." },
  estancia: { es: "Duración de la estancia", gl: "Duración da estadía", d_es: "Los días que ha durado este ingreso.", d_gl: "Os días que durou este ingreso." },
  previos: { es: "Ingresos previos (12 meses)", gl: "Ingresos previos (12 meses)", d_es: "Cuántas veces ingresó el paciente en los 12 meses anteriores a este ingreso.", d_gl: "Cantas veces ingresou o paciente nos 12 meses anteriores a este ingreso." },
  centro: { es: "Centro", gl: "Centro", d_es: "El hospital donde estuvo ingresado.", d_gl: "O hospital onde estivo ingresado." },
  sexo: { es: "Sexo", gl: "Sexo", d_es: "El sexo registrado del paciente.", d_gl: "O sexo rexistrado do paciente." },
  dias_hasta_siguiente_ingreso: { es: "Días hasta el siguiente ingreso", gl: "Días ata o seguinte ingreso", d_es: "Los días que pasan hasta el siguiente ingreso del paciente (9999 = no ha vuelto a ingresar).", d_gl: "Os días que pasan ata o seguinte ingreso do paciente (9999 = non volveu ingresar)." },
};
const pct = (x: number) => `${(100 * x).toFixed(0)} %`;
const Bar = ({ v, max = 1, color = "var(--teal)" }: { v: number; max?: number; color?: string }) => <span className="mlbar"><span style={{ width: `${Math.max(1, Math.min(100, (100 * v) / max))}%`, background: color }} /></span>;

interface Props { teamId: string; lang: Lang; onSubmit: (report: string) => Promise<unknown> }

// ---------- R6A ----------
export function MlTrain({ teamId, lang, onSubmit }: Props) {
  const es = lang === "es";
  const { rows, saved, save, err } = useMlData(teamId);
  const [sel, setSel] = useState<MlFeature[]>([]);
  const [res, setRes] = useState<{ r: TrainResult; feats: MlFeature[] } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (saved?.features && !sel.length) setSel(saved.features); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <p className="err">{es ? "No se han podido cargar los datos del laboratorio." : "Non se puideron cargar os datos do laboratorio."}</p>;
  if (!rows) return <p>…</p>;
  const toggle = (f: MlFeature) => { setSel((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f])); setRes(null); };
  const run = () => { setBusy(true); setTimeout(() => { setRes({ r: trainCached(rows, sel), feats: [...sel] }); setBusy(false); }, 30); };
  const m = res?.r.metrics;
  setDraft("r6a_entrenar", sel.length ? `features=${[...sel].sort().join(",")}` : "", `Variables marcadas: ${sel.map((f) => VAR_TEXT[f].es).join(", ") || "ninguna"}${res ? `. Último entrenamiento: AUC ${res.r.auc.toFixed(2)}` : ""}`);
  return (
    <section className="lab ml" aria-label={es ? "Entrenar el modelo" : "Adestrar o modelo"}>
      <h3>🧪 {es ? "Entrenar el modelo" : "Adestrar o modelo"}</h3>
      <p className="hint-small">{es ? `Datos: ${rows.length.toLocaleString("es")} altas de ingreso; el modelo aprende a estimar la probabilidad de que el paciente reingrese en 30 días. Se evalúa con validación cruzada de 5 grupos (siempre sobre pacientes que el modelo no ha visto).` : `Datos: ${rows.length.toLocaleString("gl")} altas de ingreso; o modelo aprende a estimar a probabilidade de que o paciente reingrese en 30 días. Avalíase con validación cruzada de 5 grupos (sempre sobre pacientes que o modelo non viu).`}</p>
      <fieldset className="mlvars">
        <legend>{es ? "① Elige las variables que usará el modelo" : "① Elixe as variables que usará o modelo"}</legend>
        {ML_FEATURES.map((f) => (
          <label key={f} className="mlvar">
            <input type="checkbox" checked={sel.includes(f)} onChange={() => toggle(f)} />
            <span><b>{VAR_TEXT[f][lang]}</b><small>{es ? VAR_TEXT[f].d_es : VAR_TEXT[f].d_gl}</small></span>
          </label>
        ))}
      </fieldset>
      <button className="primary" disabled={!sel.length || busy} onClick={run}>{busy ? "…" : `▶ ${es ? "Entrenar" : "Adestrar"}`}</button>
      {res && m && (
        <div className="mlres" aria-live="polite">
          <div className="mlkpis">
            <div><b>{res.r.auc.toFixed(2)}</b><small>AUC</small></div>
            <div><b>{pct(m.sensitivity)}</b><small>{es ? "Sensibilidad" : "Sensibilidade"}</small></div>
            <div><b>{pct(m.precision)}</b><small>{es ? "Precisión" : "Precisión"}</small></div>
            <div><b>{pct(res.r.prevalence)}</b><small>{es ? "Reingresos reales" : "Reingresos reais"}</small></div>
          </div>
          <p className="hint-small">{es ? `Sensibilidad y precisión se miden con el umbral = ${pct(res.r.prevalence)} (el porcentaje real de reingresos).` : `Sensibilidade e precisión mídense co limiar = ${pct(res.r.prevalence)} (a porcentaxe real de reingresos).`}</p>
          <div className="mlgrid">
            <table className="prev">
              <caption>{es ? "Matriz de confusión" : "Matriz de confusión"}</caption>
              <thead><tr><th /><th>{es ? "Avisa" : "Avisa"}</th><th>{es ? "No avisa" : "Non avisa"}</th></tr></thead>
              <tbody><tr><th>{es ? "Reingresó" : "Reingresou"}</th><td>{m.tp}</td><td>{m.fn}</td></tr><tr><th>{es ? "No reingresó" : "Non reingresou"}</th><td>{m.fp}</td><td>{m.tn}</td></tr></tbody>
            </table>
            <div>
              <b>{es ? "Importancia de cada variable" : "Importancia de cada variable"}</b>
              <ul className="mlimp">{res.r.importance.map((i) => <li key={i.feature}><span>{VAR_TEXT[i.feature][lang]}</span><Bar v={i.pct} max={100} /><small>{i.pct.toFixed(0)} %</small></li>)}</ul>
            </div>
          </div>
          <button className="primary" onClick={() => { save({ features: res.feats }); void onSubmit(`features=${res.feats.join(",")}`); }}>{es ? "Entregar modelo" : "Entregar modelo"}</button>
        </div>
      )}
    </section>
  );
}

// ---------- R6B ----------
function useModel(teamId: string) {
  const d = useMlData(teamId);
  const feats = (d.saved?.features?.length ? d.saved.features : DEFAULT_CLEAN).filter((f) => !f.startsWith("dias_")) as MlFeature[];
  const model = useMemo(() => (d.rows && d.saved ? trainCached(d.rows, feats) : null), [d.rows, d.saved]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...d, feats, model };
}
export function MlThreshold({ teamId, lang, onSubmit }: Props) {
  const es = lang === "es";
  const { saved, save, feats, model, err } = useModel(teamId);
  const [t, setT] = useState(0.1);
  useEffect(() => { if (saved?.threshold) setT(saved.threshold); }, [saved?.threshold]);
  if (err) return <p className="err">{es ? "No se han podido cargar los datos del laboratorio." : "Non se puideron cargar os datos do laboratorio."}</p>;
  if (!model) return <p>…</p>;
  const sim = simulateWeeks(model.probs, model.y, t);
  const over = sim.callsPerWeek > WEEKLY_CALL_CAPACITY;
  setDraft("r6b_umbral", `features=${feats.join(",")};threshold=${t.toFixed(3)}`, `Umbral ${(100 * t).toFixed(1)} %: ${sim.callsPerWeek.toFixed(0)} llamadas por semana, ${(100 * sim.sensitivity).toFixed(0)} % de reingresos detectados`);
  return (
    <section className="lab ml" aria-label={es ? "Umbral con presupuesto" : "Limiar con orzamento"}>
      <h3>🎚 {es ? "Umbral con presupuesto" : "Limiar con orzamento"}</h3>
      <p className="hint-small">{es ? `Se simulan 52 semanas con ~${WEEKLY_DISCHARGES} altas por semana en toda la red. Variables del modelo: ${feats.map((f) => VAR_TEXT[f].es).join(", ")}.` : `Simúlanse 52 semanas con ~${WEEKLY_DISCHARGES} altas por semana en toda a rede. Variables do modelo: ${feats.map((f) => VAR_TEXT[f].gl).join(", ")}.`}</p>
      <label>{es ? "Umbral: se llama al paciente si su probabilidad de reingreso supera…" : "Limiar: chámase ao paciente se a súa probabilidade de reingreso supera…"} <b>{(100 * t).toFixed(1)} %</b>
        <input type="range" min={0.05} max={0.4} step={0.005} value={t} onChange={(e) => { setT(Number(e.target.value)); save({ threshold: Number(e.target.value) }); }} aria-label={es ? "Umbral" : "Limiar"} />
      </label>
      <ul className="mlsim">
        <li><span>{es ? "Llamadas por semana" : "Chamadas por semana"}</span><Bar v={sim.callsPerWeek} max={100} color={over ? "var(--err)" : "var(--ok)"} /><b className={over ? "bad" : ""}>{sim.callsPerWeek.toFixed(0)}</b><small>{es ? `capacidad: ${WEEKLY_CALL_CAPACITY}` : `capacidade: ${WEEKLY_CALL_CAPACITY}`}</small></li>
        <li><span>{es ? "Reingresos detectados" : "Reingresos detectados"}</span><Bar v={sim.sensitivity} /><b>{pct(sim.sensitivity)}</b><small>{es ? "objetivo: al menos 30 %" : "obxectivo: polo menos 30 %"}</small></li>
        <li><span>{es ? "Casos detectados / semana" : "Casos detectados / semana"}</span><b>{sim.detectedPerWeek.toFixed(1)}</b></li>
        <li><span>{es ? "Reingresos perdidos / semana" : "Reingresos perdidos / semana"}</span><b>{sim.missedPerWeek.toFixed(1)}</b></li>
        <li><span>{es ? "Falsas alarmas / semana" : "Falsas alarmas / semana"}</span><b>{sim.falseAlarmsPerWeek.toFixed(1)}</b></li>
      </ul>
      <button className="primary" onClick={() => void onSubmit(`features=${feats.join(",")};threshold=${t.toFixed(3)}`)}>{es ? "Entregar umbral" : "Entregar limiar"}</button>
    </section>
  );
}

// ---------- R6C ----------
export function MlEquity({ teamId, lang, onSubmit }: Props) {
  const es = lang === "es";
  const { rows, saved, feats, model, err } = useModel(teamId);
  const [decision, setDecision] = useState("");
  const [text, setText] = useState("");
  if (err) return <p className="err">{es ? "No se han podido cargar los datos del laboratorio." : "Non se puideron cargar os datos do laboratorio."}</p>;
  if (!model || !rows) return <p>…</p>;
  const t = saved?.threshold ?? 0.16;
  const g = sensitivityByGroup(rows, model.probs, t);
  setDraft("r6c_equidad", decision ? `decision=${decision};text=${text.trim().replace(/\n/g, " ")}` : "", `Decisión: ${decision || "(sin elegir)"}; frase: «${text.trim()}»`);
  const all = model.y.reduce((a, b) => a + b, 0);
  const total = metricsTotal(model, t, all);
  const label = (k: string) => (k === "F" ? (es ? "Mujeres" : "Mulleres") : k === "M" ? (es ? "Homes" : "Homes") : k);
  const chart = (title: string, data: { group: string; n: number; cases: number; sensitivity: number }[]) => (
    <div>
      <b>{title}</b>
      <ul className="mlimp">{data.map((d) => <li key={d.group}><span>{label(d.group)} <small>(n={d.n}, {es ? "reingresos" : "reingresos"}: {d.cases})</small></span><Bar v={d.sensitivity} max={0.7} color={d.sensitivity < total * 0.75 ? "var(--err)" : "var(--teal)"} /><b>{pct(d.sensitivity)}</b></li>)}</ul>
    </div>
  );
  const opts: [string, string, string][] = [
    ["deploy", es ? "Desplegar el modelo" : "Despregar o modelo", es ? "Se usa tal cual para avisar a la enfermería." : "Úsase tal cal para avisar á enfermaría."],
    ["deploy_review", es ? "Desplegar con revisión humana" : "Despregar con revisión humana", es ? "Se usa, pero una persona revisa los avisos (y los casos que el modelo no marca)." : "Úsase, pero unha persoa revisa os avisos (e os casos que o modelo non marca)."],
    ["no_deploy", es ? "No desplegar" : "Non despregar", es ? "No se usa hasta mejorarlo." : "Non se usa ata mellorar."],
  ];
  return (
    <section className="lab ml" aria-label={es ? "Equidad y decisión" : "Equidade e decisión"}>
      <h3>⚖️ {es ? "Equidad y decisión" : "Equidade e decisión"}</h3>
      <p className="hint-small">{es ? `Sensibilidad = de los reingresos reales, qué porcentaje detecta el modelo (umbral ${(100 * t).toFixed(1)} %; variables: ${feats.map((f) => VAR_TEXT[f].es).join(", ")}). En rojo: grupos donde detecta bastante menos que la media (${pct(total)}).` : `Sensibilidade = dos reingresos reais, que porcentaxe detecta o modelo (limiar ${(100 * t).toFixed(1)} %; variables: ${feats.map((f) => VAR_TEXT[f].gl).join(", ")}). En vermello: grupos onde detecta bastante menos ca a media (${pct(total)}).`}</p>
      <div className="mlgrid">{chart(es ? "Por sexo" : "Por sexo", g.sexo)}{chart(es ? "Por tramo de edad" : "Por tramo de idade", g.edad)}</div>
      <fieldset className="mlvars"><legend>{es ? "Tu decisión" : "A túa decisión"}</legend>
        {opts.map(([id, l, d]) => <label key={id} className="mlvar"><input type="radio" name="mldec" checked={decision === id} onChange={() => setDecision(id)} /><span><b>{l}</b><small>{d}</small></span></label>)}
      </fieldset>
      <label>{es ? "Justifícalo con una frase (cita grupos y diferencias que ves en el gráfico)" : "Xustifícao cunha frase (cita grupos e diferenzas que ves no gráfico)"}
        <textarea value={text} maxLength={300} rows={3} onChange={(e) => setText(e.target.value)} />
        <small className="hint-small">{text.length}/300</small>
      </label>
      <button className="primary" disabled={!decision || text.trim().length < 10} onClick={() => void onSubmit(`decision=${decision};text=${text.trim().replace(/\n/g, " ")}`)}>{es ? "Entregar decisión" : "Entregar decisión"}</button>
    </section>
  );
}
function metricsTotal(model: TrainResult, t: number, cases: number): number {
  let tp = 0; model.probs.forEach((p, i) => { if (model.y[i] && p >= t) tp++; });
  return cases ? tp / cases : 0;
}
