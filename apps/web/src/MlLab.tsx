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

export const VAR_TEXT: Record<MlFeature, { es: string; gl: string; d_es: string; d_gl: string }> = {
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

interface Props { teamId: string; lang: Lang; onSubmit: (report: string) => Promise<unknown>; /** a delivered answer, to show a solved level read-only */ initial?: string }
const kvOf = (s?: string) => Object.fromEntries((s ?? "").split(";").filter(Boolean).map((p) => { const i = p.indexOf("="); return [p.slice(0, i), p.slice(i + 1)]; }));

/**
 * How the model predicts (27-nov). Patients are ordered from the lowest to the highest risk the model gives them and cut
 * into 10 groups of the same size. Dots = the real % that came back in each group (what had to be predicted); line = the
 * % the model predicted. Under it, every patient is a tick (red = came back): a useful model pushes the red to the right.
 */
export function PredictionChart({ probs, y, lang }: { probs: number[]; y: number[]; lang: Lang }) {
  const es = lang === "es";
  const order = probs.map((p, i) => i).sort((a, b) => probs[a] - probs[b]);
  const G = 10, size = Math.ceil(order.length / G);
  const groups = Array.from({ length: G }, (_, g) => order.slice(g * size, (g + 1) * size)).filter((x) => x.length)
    .map((ix) => ({ pred: ix.reduce((s, i) => s + probs[i], 0) / ix.length, real: ix.reduce((s, i) => s + y[i], 0) / ix.length }));
  const prev = y.reduce((s, v) => s + v, 0) / Math.max(1, y.length);
  const top = Math.min(1, Math.max(0.3, ...groups.map((g) => Math.max(g.pred, g.real))) * 1.1);
  const W = 320, H = 150, L = 34, B = 128, T = 10, R = 8;
  const X = (g: number) => L + ((g + 0.5) / groups.length) * (W - L - R), Yv = (v: number) => B - (v / top) * (B - T);
  const line = groups.map((g, i) => `${X(i)},${Yv(g.pred)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  // one tick per patient (a sample if there are many), ordered by risk
  const step = Math.max(1, Math.floor(order.length / 600));
  const strip = order.filter((_, k) => k % step === 0);
  return (
    <figure className="mlpred">
      <figcaption><b>{es ? "¿Cómo predice este modelo?" : "Como predí este modelo?"}</b></figcaption>
      <svg viewBox={`0 0 ${W} ${H + 26}`} role="img" aria-label={es ? "Reingresos reales y previstos por grupo de riesgo" : "Reingresos reais e previstos por grupo de risco"}>
        {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={Yv(v)} y2={Yv(v)} stroke="currentColor" strokeOpacity="0.12" /><text x={L - 4} y={Yv(v) + 3} fontSize="7" textAnchor="end" fill="currentColor" opacity="0.7">{Math.round(100 * v)} %</text></g>)}
        <line x1={L} x2={W - R} y1={Yv(prev)} y2={Yv(prev)} stroke="currentColor" strokeOpacity="0.5" strokeDasharray="3 3" />
        <polyline points={line} fill="none" stroke="#4995FF" strokeWidth="2" />
        {groups.map((g, i) => <circle key={i} cx={X(i)} cy={Yv(g.real)} r="3.4" fill="#FFAE41" stroke="#8a5a00" strokeWidth="0.6"><title>{`${es ? "Grupo" : "Grupo"} ${i + 1}: ${es ? "reales" : "reais"} ${(100 * g.real).toFixed(1)} % · ${es ? "previsto" : "previsto"} ${(100 * g.pred).toFixed(1)} %`}</title></circle>)}
        {groups.map((_, i) => <text key={i} x={X(i)} y={B + 9} fontSize="6.5" textAnchor="middle" fill="currentColor" opacity="0.7">{i + 1}</text>)}
        {strip.map((i, k) => <line key={k} x1={L + (k / strip.length) * (W - L - R)} x2={L + (k / strip.length) * (W - L - R)} y1={H + 6} y2={H + 20} stroke={y[i] ? "var(--err, #c62828)" : "currentColor"} strokeOpacity={y[i] ? 0.9 : 0.12} strokeWidth="0.8" />)}
        <text x={L} y={H + 3} fontSize="6.5" fill="currentColor" opacity="0.75">{es ? "menos riesgo según el modelo →" : "menos risco segundo o modelo →"}</text>
        <text x={W - R} y={H + 3} fontSize="6.5" textAnchor="end" fill="currentColor" opacity="0.75">{es ? "más riesgo" : "máis risco"}</text>
      </svg>
      <ul className="mllegend">
        <li><span className="dot" /> {es ? "Lo que pasó de verdad: % de pacientes de ese grupo que volvieron a ingresar" : "O que pasou de verdade: % de pacientes dese grupo que volveron ingresar"}</li>
        <li><span className="ln" /> {es ? "Lo que predijo el modelo para ese grupo" : "O que predixo o modelo para ese grupo"}</li>
        <li><span className="dash" /> {es ? `Media de todos (${(100 * prev).toFixed(0)} %): lo que diría un modelo que no sabe nada` : `Media de todos (${(100 * prev).toFixed(0)} %): o que diría un modelo que non sabe nada`}</li>
        <li><span className="tick" /> {es ? "Abajo, cada rayita es un paciente, de menos a más riesgo; en rojo, los que volvieron" : "Abaixo, cada raiña é un paciente, de menos a máis risco; en vermello, os que volveron"}</li>
      </ul>
      <p className="hint-small">{es
        ? "Los pacientes se ordenan según el riesgo que les da el modelo y se parten en 10 grupos iguales (1 = menos riesgo). Un modelo útil sube de izquierda a derecha, los puntos siguen a la línea y lo rojo se amontona a la derecha. Si la línea es plana, el modelo no distingue. Si es casi perfecta, desconfiad: ¿usa algo que no se sabe en el momento del alta?"
        : "Os pacientes ordénanse segundo o risco que lles dá o modelo e pártense en 10 grupos iguais (1 = menos risco). Un modelo útil sobe de esquerda a dereita, os puntos seguen a liña e o vermello amoréase á dereita. Se a liña é plana, o modelo non distingue. Se é case perfecta, desconfiade: usa algo que non se sabe no momento da alta?"}</p>
    </figure>
  );
}
const METRIC_HELP: { k: string; es: string; gl: string }[] = [
  { k: "AUC", es: "Lo bien que ORDENA a los pacientes de menos a más riesgo: 0,5 = como tirar una moneda, 1 = perfecto. En salud, 0,7-0,8 ya es útil.", gl: "Como de ben ORDENA os pacientes de menos a máis risco: 0,5 = como tirar unha moeda, 1 = perfecto. En saúde, 0,7-0,8 xa é útil." },
  { k: "Sensibilidad", es: "De los pacientes que de verdad volvieron, cuántos avisó el modelo. Si es baja, se le escapan casos.", gl: "Dos pacientes que de verdade volveron, cantos avisou o modelo. Se é baixa, escápanselle casos." },
  { k: "Precisión", es: "De los avisos que da el modelo, cuántos aciertan. Si es baja, las enfermeras llaman a mucha gente que no iba a volver.", gl: "Dos avisos que dá o modelo, cantos acertan. Se é baixa, as enfermeiras chaman a moita xente que non ía volver." },
  { k: "Reingresos reales", es: "El % de pacientes que vuelve de verdad. Es la línea discontinua del gráfico.", gl: "A % de pacientes que volve de verdade. É a liña descontinua do gráfico." },
  { k: "Matriz de confusión", es: "Cuenta los cuatro casos: avisó y volvió (acierto), avisó y no volvió (falsa alarma), no avisó y volvió (se le escapó) y no avisó y no volvió.", gl: "Conta os catro casos: avisou e volveu (acerto), avisou e non volveu (falsa alarma), non avisou e volveu (escapóuselle) e non avisou e non volveu." },
];

// ---------- R6A ----------
export function MlTrain({ teamId, lang, onSubmit, initial }: Props) {
  const es = lang === "es";
  const { rows, saved, save, err } = useMlData(teamId);
  const [sel, setSel] = useState<MlFeature[]>([]);
  const [res, setRes] = useState<{ r: TrainResult; feats: MlFeature[] } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (saved?.features && !sel.length) setSel(saved.features); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  // read-only (solved level): the delivered variables, trained again so the results and the chart are there
  const given = initial ? (kvOf(initial).features ?? "").split(",").filter((f): f is MlFeature => (ML_FEATURES as readonly string[]).includes(f)) : null;
  useEffect(() => { if (given?.length && rows) { setSel(given); setRes({ r: trainCached(rows, given), feats: given }); } }, [rows, initial]); // eslint-disable-line react-hooks/exhaustive-deps
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
          <details className="mlhelp">
            <summary>{es ? "¿Qué significa cada medida?" : "Que significa cada medida?"}</summary>
            <dl>{METRIC_HELP.map((h) => <div key={h.k}><dt>{h.k === "Sensibilidad" && !es ? "Sensibilidade" : h.k === "Precisión" ? "Precisión" : h.k === "Reingresos reales" && !es ? "Reingresos reais" : h.k}</dt><dd>{h[lang]}</dd></div>)}</dl>
          </details>
          <PredictionChart probs={res.r.probs} y={res.r.y} lang={lang} />
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
export function MlEquity({ teamId, lang, onSubmit, initial }: Props) {
  const es = lang === "es";
  const { rows, saved, feats, model, err } = useModel(teamId);
  const [decision, setDecision] = useState(() => kvOf(initial).decision ?? "");
  const [text, setText] = useState(() => kvOf(initial).text ?? "");
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
