import { useEffect, useMemo, useState } from "react";
import { buildReport, closure, compile, dag, runProject, type Lang, type ModelDef, type Project, type RunReport } from "@codigo-alta/shared";
import { getEngine } from "./duck";
import { restoreRaw } from "./raw";
import { toolState } from "./kv";
import { readableSql } from "./FileViewer";
import { emit, setDraft } from "./workContext";

const store = {
  read: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
};
type L2 = { es: string; gl: string };
// what each model is, in plain words (the technical name is shown small)
const MODEL_TEXT: Record<string, { title: L2; what: L2 }> = {
  int_admission_episodes: { title: { es: "Episodios de ingreso", gl: "Episodios de ingreso" }, what: { es: "Junta las visitas de cada persona en episodios (estancias en el hospital).", gl: "Xunta as visitas de cada persoa en episodios (estadías no hospital)." } },
  fct_admission: { title: { es: "Reingresos", gl: "Reingresos" }, what: { es: "Marca qué episodios son un reingreso a 30 días.", gl: "Marca que episodios son un reingreso a 30 días." } },
  stg_encounters: { title: { es: "Visitas limpias", gl: "Visitas limpas" }, what: { es: "Limpia las fechas, los tipos de visita y los repetidos.", gl: "Limpa as datas, os tipos de visita e os repetidos." } },
  stg_patients: { title: { es: "Pacientes protegidos", gl: "Pacientes protexidos" }, what: { es: "Cambia el ssn por un código seudónimo.", gl: "Cambia o ssn por un código pseudónimo." } },
  dim_patient: { title: { es: "Dimensión paciente", gl: "Dimensión paciente" }, what: { es: "Una fila por persona: tramo de edad, sexo y área.", gl: "Unha fila por persoa: tramo de idade, sexo e área." } },
  dim_hospital: { title: { es: "Dimensión hospital", gl: "Dimensión hospital" }, what: { es: "Una fila por centro.", gl: "Unha fila por centro." } },
  dim_date: { title: { es: "Dimensión fecha", gl: "Dimensión data" }, what: { es: "Una fila por día del calendario.", gl: "Unha fila por día do calendario." } },
  fct_condition: { title: { es: "Hechos: diagnósticos", gl: "Feitos: diagnósticos" }, what: { es: "Una fila cada vez que se diagnostica algo.", gl: "Unha fila cada vez que se diagnostica algo." } },
};
/** The rest of the star of «Esquema en estrella» (no pieces to choose): built with the readmission model, so the gold layer really has its facts and dimensions. */
export const STAR_MODELS = ["dim_patient", "dim_hospital", "dim_date", "fct_condition"];
/** The checks in plain words (the runner's messages talk about columns and expressions). */
const TEST_TEXT = (t: { test: string; status: string; message: string; failures: number }, es: boolean) => {
  if (t.status === "pass") return es ? "Comprobación superada" : "Comprobación superada";
  if (t.test.includes("discharge_ts >= admit_ts")) return es ? `${t.failures} episodios tienen el alta ANTES que el ingreso (estancias negativas)` : `${t.failures} episodios teñen a alta ANTES ca o ingreso (estadías negativas)`;
  if (t.test.startsWith("unique")) return es ? `Hay ${t.failures} episodios repetidos: revisad las piezas` : `Hai ${t.failures} episodios repetidos: revisade as pezas`;
  if (t.test.startsWith("not_null")) return es ? `Hay ${t.failures} filas sin código: revisad las piezas` : `Hai ${t.failures} filas sen código: revisade as pezas`;
  return t.message;
};

/**
 * The model builder (R3C): each model is a card with its pieces as plain-language questions. The code is there for whoever
 * wants to see it, but nobody needs to read SQL to play. The pieces chosen are reported to Lumi as a draft.
 */
export function ModelBuilder({ teamId, lang, project: full, names: namesProp, noSubmit, onSubmit, done, lockId }: { teamId: string; lang: Lang; project: Project; names?: string[]; noSubmit?: boolean; onSubmit: (report: string) => Promise<void>; done: boolean; lockId?: string }) {
  const names = namesProp ?? full.models.filter((m) => m.name.startsWith("stg_")).map((m) => m.name);
  const cl = closure(full.models, names.includes("fct_admission") ? [...names, ...STAR_MODELS.filter((n) => full.models.some((m) => m.name === n))] : names);
  const project: Project = { models: full.models.filter((m) => cl.includes(m.name)), tests: full.tests.filter((t) => cl.includes(t.model) && (t.kind !== "relationships" || cl.includes(t.toModel))) };
  const shown = (n: string) => names.includes(n) || (!n.startsWith("stg_") && cl.includes(n)); // models whose result is listed
  const es = lang === "es";
  const key = `ca_mb_${teamId}`;
  const [choices, setChoices] = useState<Record<string, Record<string, string>>>(() => { try { return JSON.parse(store.read(key) ?? "{}"); } catch { return {}; } });
  const [report, setReport] = useState<RunReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { order } = useMemo(() => dag(project.models), [project]);
  const tx = (t: any) => (typeof t === "string" ? t : (t?.[lang] ?? t?.es ?? ""));
  const [mbLoaded, setMbLoaded] = useState(false);
  useEffect(() => { toolState.load(teamId, "mb").then((v) => { try { setChoices(v ? JSON.parse(v) : {}); } catch { /* ignore */ } setMbLoaded(true); }); }, [teamId]);
  useEffect(() => { if (mbLoaded) toolState.save(teamId, "mb", JSON.stringify(choices)); }, [choices, teamId, mbLoaded]); // never overwrite the server with a stale local copy
  const editable = project.models.filter((m) => names.includes(m.name) && m.slots);
  useEffect(() => {
    if (!lockId) return;
    const parts = editable.flatMap((m) => Object.keys(m.slots!).flatMap((s) => (choices[m.name]?.[s] ? [`${m.name}.${s}=${choices[m.name][s]}`] : [])));
    const words = editable.flatMap((m) => Object.entries(m.slots!).map(([s, d]) => { const o = d.options.find((x) => x.id === choices[m.name]?.[s]); return `${tx(d.label)} → ${o ? tx(o.plain) || o.sql : "(sin elegir)"}`; }));
    setDraft(lockId, parts.length ? `slots:${parts.join(",")}` : "", `Piezas del modelo: ${words.join("; ")}${report ? `. Último cálculo: ${report.ok ? "sin errores" : "con errores"}` : ""}`);
  }, [choices, report, lockId]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (m: ModelDef, slot: string, id: string) => { setChoices((c) => ({ ...c, [m.name]: { ...(c[m.name] ?? {}), [slot]: id } })); setReport(null); };
  const allChosen = project.models.every((m) => !names.includes(m.name) || Object.keys(m.slots ?? {}).every((s) => choices[m.name]?.[s]));
  const run = async () => {
    setBusy(true); setMsg("");
    try {
      if (!(await restoreRaw(teamId))) { setMsg(es ? "Primero terminad de cargar los ficheros en «La bandeja de entrada»." : "Primeiro rematade de cargar os ficheiros en «A caixa de entrada»."); return; }
      const eng = await getEngine();
      setReport(await runProject(eng, project, choices));
      emit({ type: "lab:refresh" }); // the new tables can now be asked in the Query Lab
    } catch (e) { setMsg(String((e as Error).message)); } finally { setBusy(false); }
  };
  const canSubmit = !!report && report.ok && report.tests.every((t) => t.status === "pass" || t.status === "warn") && allChosen;
  const status = (n: string) => report?.models.find((m) => m.model === n);
  const chain = order.filter((n) => cl.includes(n));

  return (
    <div className="mb">
      {lockId === "r3c_modelo" && (
        // the rules are NOT copied here: finding them in the document is part of the level (26-nov)
        <p className="protonote">📄 {es ? "Las reglas de cada pieza están en el protocolo oficial, dentro del documento " : "As regras de cada peza están no protocolo oficial, dentro do documento "}<button className="doclink" onClick={() => emit({ type: "doc:open", path: "docs/peticiones-direccion.md" })}>docs/peticiones-direccion.md</button>{es ? ". Abridlo y buscad la frase que responde a cada pregunta." : ". Abrídeo e buscade a frase que responde a cada pregunta."}</p>
      )}
      <ol className="chain" aria-label={es ? "Orden del cálculo" : "Orde do cálculo"}>
        {chain.map((n) => { const st = status(n); return <li key={n} className={st?.status === "ok" ? "ok" : st?.status === "error" ? "bad" : ""}><b>{MODEL_TEXT[n] ? tx(MODEL_TEXT[n].title) : n}</b><small>{n}</small>{st?.rows != null && <small>{st.rows.toLocaleString(lang)} {es ? "filas" : "filas"}</small>}</li>; })}
      </ol>
      {editable.map((m, k) => (
        <section key={m.name} className="mcard" aria-label={m.name}>
          <h3>{k + 1}. {MODEL_TEXT[m.name] ? tx(MODEL_TEXT[m.name].title) : m.name} <small className="tech">{m.name}</small></h3>
          {MODEL_TEXT[m.name] && <p className="hint-small">{tx(MODEL_TEXT[m.name].what)}</p>}
          {Object.entries(m.slots!).map(([slot, def]) => {
            const cur = choices[m.name]?.[slot];
            const o = def.options.find((x) => x.id === cur);
            return (
              <fieldset key={slot} className="piece">
                <legend>{tx(def.label)}</legend>
                {def.options.map((op) => (
                  <label key={op.id} className={`popt ${cur === op.id ? "on" : ""}`}>
                    <input type="radio" name={`${m.name}.${slot}`} value={op.id} checked={cur === op.id} disabled={done} onChange={() => choose(m, slot, op.id)} />
                    <span>{tx(op.plain) || op.sql}<code>{op.sql}</code></span>
                  </label>
                ))}
                {o?.explain && <p className="pexplain">→ {tx(o.explain)}</p>}
              </fieldset>
            );
          })}
        </section>
      ))}
      <div className="row">
        <button className="primary" disabled={busy || !allChosen || done} onClick={run}>{busy ? (es ? "Calculando…" : "Calculando…") : es ? "▶ Calcular" : "▶ Calcular"}</button>
        <button className="primary" disabled={!canSubmit || busy || done} hidden={noSubmit} onClick={() => onSubmit(buildReport({ ...report!, models: report!.models.filter((x) => names.includes(x.model)) }, Object.fromEntries(names.map((n) => [n, choices[n] ?? {}]))))}>{es ? "Entregar" : "Entregar"}</button>
        {!allChosen && <small className="hint-small">{es ? "Elegid todas las piezas para poder calcular." : "Elixide todas as pezas para poder calcular."}</small>}
      </div>
      <p className="err" role="alert">{msg}</p>
      {report && (
        <section aria-label={es ? "Resultado" : "Resultado"} className="mbres">
          <h3>{es ? "Resultado del cálculo" : "Resultado do cálculo"}</h3>
          <ul className="results">
            {report.models.filter((x) => shown(x.model)).map((x) => <li key={x.model} className={x.status === "ok" ? "pass" : "fail"}>{x.status === "ok" ? "✔" : "✘"} {MODEL_TEXT[x.model] ? tx(MODEL_TEXT[x.model].title) : x.model} {x.rows != null && `· ${x.rows.toLocaleString(lang)} ${es ? "filas" : "filas"}`} {x.error && <em>— {x.error}</em>}</li>)}
            {report.tests.filter((t) => shown(t.model) && t.status !== "pass").map((t) => <li key={t.id} className={t.status}>{t.status === "warn" ? "🟡" : t.status === "skipped" ? "⚪" : "🔴"} {TEST_TEXT(t, es)}{t.status === "warn" ? (es ? " (es un aviso, no un error: lo investigaréis en la sala siguiente)" : " (é un aviso, non un erro: investigarédelo na sala seguinte)") : ""}</li>)}
            <li className="pass">🟢 {report.tests.filter((t) => shown(t.model) && t.status === "pass").length} {es ? "comprobaciones superadas" : "comprobacións superadas"}</li>
          </ul>
        </section>
      )}
      <details className="codedetails">
        <summary>{es ? "Ver el código SQL (opcional)" : "Ver o código SQL (opcional)"}</summary>
        {editable.map((m) => {
          let c = "";
          try { c = compile(m, choices[m.name] ?? {}); } catch { c = readableSql(m.sql, m.slots as any, lang); }
          return <div key={m.name}><h4>{m.name}.sql</h4><pre className="sql">{readableSql(c, m.slots as any, lang)}</pre></div>;
        })}
      </details>
    </div>
  );
}
