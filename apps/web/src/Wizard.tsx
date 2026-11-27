import { useCallback, useEffect, useMemo, useState } from "react";
import { analyze, consolidateEncounters, decode, fileReport, FILE_SPECS, loadRaw, rawTableName, type Analysis, type DateFmt, type Encoding, type FileOpts, type Lang } from "@codigo-alta/shared";
import { fetchRaw, getEngine } from "./duck";
import { toolState } from "./kv";
import { FileInfo } from "./FileInfo";
import { setDraft } from "./workContext";

const DELIMS = [{ v: ",", l: "coma ( , )" }, { v: ";", l: "punto y coma ( ; )" }, { v: "\t", l: "tabulador" }, { v: "|", l: "barra ( | )" }];
const ENCS: { v: Encoding; l: string }[] = [{ v: "utf-8", l: "UTF-8" }, { v: "latin-1", l: "Latin-1 (ISO-8859-1)" }];
const DATES: { v: DateFmt; l: string }[] = [{ v: "none", l: "Sin fechas / no aplica" }, { v: "iso", l: "2023-01-31 14:05:00" }, { v: "dmy_hm", l: "31/01/2023 14:05" }, { v: "mdy_hm", l: "01/31/2023 14:05" }];
const DEFAULT: FileOpts = { delimiter: ",", encoding: "utf-8", dateFormat: "none" };
const store = {
  read: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  write: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export function Wizard({ teamId, lang, sheet, onSubmit, done }: { teamId: string; lang: Lang; sheet: Record<string, any> | null; onSubmit: (report: string) => Promise<void>; done: boolean }) {
  const key = `ca_wiz_${teamId}`;
  const [opts, setOpts] = useState<Record<string, FileOpts>>(() => { try { return JSON.parse(store.read(key) ?? "{}"); } catch { return {}; } });
  const [sel, setSel] = useState(FILE_SPECS[0].name);
  useEffect(() => { toolState.load(teamId, "wiz").then((v) => { try { setOpts(v ? JSON.parse(v) : {}); } catch { /* ignore */ } }); }, [teamId]);
  const [loaded, setLoaded] = useState<Record<string, string>>({}); // file -> report
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const spec = FILE_SPECS.find((s) => s.name === sel)!;
  const o = opts[sel] ?? DEFAULT;
  const es = lang === "es";

  useEffect(() => {
    let live = true;
    fetchRaw(sel).then((b) => { if (live) setAnalysis(analyze(decode(b, o.encoding), o, spec)); }).catch((e) => setErr(String(e.message)));
    return () => { live = false; };
  }, [sel, o.delimiter, o.encoding, o.dateFormat]); // eslint-disable-line

  const set = (patch: Partial<FileOpts>) => { const n = { ...opts, [sel]: { ...o, ...patch } }; setOpts(n); toolState.save(teamId, "wiz", JSON.stringify(n)); setLoaded((l) => { const { [sel]: _, ...rest } = l; return rest; }); };

  const load = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      // analyse at click time with the current options (never trust a possibly stale preview)
      const a = analyze(decode(await fetchRaw(sel), o.encoding), o, spec);
      const eng = await getEngine();
      await loadRaw(eng, rawTableName(sel), a);
      setLoaded((l) => ({ ...l, [sel]: fileReport(a, spec) }));
      const n = { ...opts, [sel]: o };
      setOpts(n);
      toolState.save(teamId, "wiz", JSON.stringify(n));
    } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  }, [sel, spec, o]);

  const all = FILE_SPECS.every((s) => loaded[s.name]);
  // Lumi sees what is loaded (the server checks each file) and the options chosen for every file
  useEffect(() => {
    const sep = (d: string) => DELIMS.find((x) => x.v === d)?.l ?? d;
    const words = FILE_SPECS.map((f) => { const x = opts[f.name] ?? DEFAULT; return `${f.name}: ${loaded[f.name] ? "CARGADO" : "sin cargar"} (separador ${sep(x.delimiter)}, ${x.encoding}, fecha ${DATES.find((d) => d.v === x.dateFormat)?.l})`; });
    const a = analysis ? ` Vista previa de ${sel}: ${analysis.valid.length} filas buenas, ${analysis.rejected.length} rechazadas, ${analysis.header.length} columnas, ${analysis.dateFailures} con fecha ilegible, ${analysis.mojibake} con símbolos raros.` : "";
    setDraft("r1a_bandeja", Object.values(loaded).sort().join("\n"), `${words.join("; ")}.${a}`);
  }, [opts, loaded, analysis, sel]);
  const validate = async () => {
    setBusy(true);
    try {
      const eng = await getEngine();
      await consolidateEncounters(eng, FILE_SPECS.filter((s) => s.name.startsWith("encounters")).map((s) => rawTableName(s.name)));
      await onSubmit(Object.values(loaded).sort().join("\n"));
    } catch (e) { setErr(String((e as Error).message)); } finally { setBusy(false); }
  };

  const sheetInfo = sheet?.files?.[sel];
  const reasons = useMemo(() => analysis ? { col: analysis.rejected.filter((r) => r.reason === "columnas").length, date: analysis.dateFailures } : null, [analysis]);

  return (
    <div className="wizard">
      <ul className="files" aria-label={es ? "Ficheros" : "Ficheiros"}>
        {FILE_SPECS.map((s) => (
          <li key={s.name}><button className={`filebtn ${sel === s.name ? "on" : ""}`} onClick={() => setSel(s.name)} aria-current={sel === s.name}>{loaded[s.name] ? "✔ " : "○ "}{s.name}</button></li>
        ))}
      </ul>
      <div className="wiz-main">
        <h3>{sel}</h3>
        <FileInfo name={sel} lang={lang} />
        {sheetInfo && <p className="sheet">📄 {es ? "Hoja de especificaciones" : "Folla de especificacións"}: {es ? "separador" : "separador"} «{sheetInfo.delimiter}», {sheetInfo.encoding}{sheetInfo.date_format ? `, ${sheetInfo.date_format}` : ""}</p>}
        <div className="opts">
          <label>{es ? "Separador" : "Separador"}<select disabled={done} value={o.delimiter} onChange={(e) => set({ delimiter: e.target.value })}>{DELIMS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}</select></label>
          <label>{es ? "Codificación" : "Codificación"}<select disabled={done} value={o.encoding} onChange={(e) => set({ encoding: e.target.value as Encoding })}>{ENCS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}</select></label>
          <label>{es ? "Formato de fecha" : "Formato de data"}<select disabled={done} value={o.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as DateFmt })}>{DATES.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}</select></label>
        </div>
        {analysis && (
          <>
            <p aria-live="polite" className="counts">
              <b>{analysis.valid.length.toLocaleString(lang)}</b> {es ? "filas buenas" : "filas boas"} · <b className={analysis.rejected.length ? "bad" : ""}>{analysis.rejected.length}</b> {es ? "rechazadas" : "rexeitadas"} · {analysis.header.length} {es ? "columnas" : "columnas"}
              {reasons && reasons.date > 0 && <span className="bad"> · {reasons.date} {es ? "con fecha ilegible" : "con data ilexible"}</span>}
              {analysis.mojibake > 0 && <span className="bad"> · {analysis.mojibake} {es ? "con símbolos raros (¿codificación?)" : "con símbolos raros (codificación?)"}</span>}
            </p>
            <div className="scroll"><table className="prev">
              <thead><tr>{analysis.header.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>{analysis.preview.slice(0, 8).map((r, i) => <tr key={i} className={r.bad ? "rowbad" : ""}>{r.cells.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table></div>
            {analysis.header.length <= 1 && <p className="note-warn">👉 {es ? "Solo se ve UNA columna enorme: el «Separador» no es el correcto. Mira qué símbolo se repite entre los datos de la fila (; | o un hueco grande, que es el tabulador) y elígelo." : "Só se ve UNHA columna enorme: o «Separador» non é o correcto. Mira que símbolo se repite entre os datos da fila (; | ou un oco grande, que é o tabulador) e elíxeo."}</p>}
            {analysis.header.length > 1 && analysis.mojibake > 0 && <p className="note-warn">👉 {es ? "Hay símbolos raros donde deberían ir tildes: cambia la «Codificación»." : "Hai símbolos raros onde deberían ir acentos: cambia a «Codificación»."}</p>}
            {analysis.header.length > 1 && reasons && reasons.date > 0 && <p className="note-warn">👉 {es ? "Las filas fallan porque la FECHA no se entiende. Mira cómo se escriben las fechas en la tabla (columna start_ts) y cambia el «Formato de fecha» al que coincida." : "As filas fallan porque a DATA non se entende. Mira como se escriben as datas na táboa (columna start_ts) e cambia o «Formato de data» ao que coincida."}</p>}
            {reasons && reasons.col > 0 && reasons.date === 0 && analysis.mojibake === 0 && analysis.header.length > 1 && (
              <p className="note-ok">ℹ️ {es ? `Las ${reasons.col} filas rechazadas llegan CORTADAS en el propio fichero (les faltan columnas). No es culpa de tus opciones: separador, codificación y fecha están bien. Es lo esperado: se descartan y se anotan. Puedes verlas en «Ver filas rechazadas» y cargar el fichero.` : `As ${reasons.col} filas rexeitadas chegan CORTADAS no propio ficheiro (fáltanlles columnas). Non é culpa das túas opcións: separador, codificación e data están ben. É o esperado: descártanse e anótanse. Podes velas en «Ver filas rexeitadas» e cargar o ficheiro.`}</p>
            )}
            {analysis.rejected.length > 0 && <details><summary>{es ? "Ver filas rechazadas" : "Ver filas rexeitadas"}</summary><ul className="rej">{analysis.rejected.slice(0, 6).map((r, i) => <li key={i}>L{r.line} ({r.reason}): <code>{r.raw.slice(0, 90)}</code></li>)}</ul></details>}
          </>
        )}
        <p className="err" role="alert">{err}</p>
        <button disabled={busy || !analysis || done} onClick={load}>{loaded[sel] ? (es ? "Volver a cargar" : "Volver cargar") : (es ? "Cargar este fichero" : "Cargar este ficheiro")}</button>
        <button className="primary" disabled={busy || !all || done} onClick={validate}>{es ? "Validar carga" : "Validar carga"} ({Object.keys(loaded).length}/{FILE_SPECS.length})</button>
      </div>
    </div>
  );
}
