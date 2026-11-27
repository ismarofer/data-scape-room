import { useEffect, useRef, useState } from "react";
import { guardSql, type Lang } from "@codigo-alta/shared";
import { ensureCanon, getEngine } from "./duck";
import { restoreRaw } from "./raw";
import { setDraft } from "./workContext";
import { toolState } from "./kv";

/** A level tool. `bad` = ids the server marked wrong in the last delivery: they are painted red until the team changes them. */
type Props = { lang: Lang; onSubmit: (report: string) => Promise<unknown>; bad?: string[]; /** a delivered report, to show a solved level read-only */ initial?: string };
const kvOf = (s?: string) => Object.fromEntries((s ?? "").split(";").filter(Boolean).map((p) => { const i = p.indexOf("="); return [p.slice(0, i), p.slice(i + 1)]; }));
/** Red marks from the last delivery; a mark disappears as soon as that item is changed. */
function useBadMarks(bad?: string[]) {
  const [marks, setMarks] = useState<string[]>([]);
  useEffect(() => { setMarks(bad ?? []); }, [bad]);
  return { isBad: (id: string) => marks.includes(id), clear: (id: string) => setMarks((m) => m.filter((x) => x !== id)) };
}

// ------------------------------------------------------------------ R3B star schema canvas
// No tiny connection dots: a table is joined by clicking it and then another one, or by dragging from anywhere on one
// card and dropping on another. The arrow is always drawn from the fact to the dimension; two tables of the same kind
// are not joined (a short message explains why). Table names have no fct_/dim_ prefix (it gave the answer away):
// the team decides from what a row is and from the key columns.
type Kind = "dim" | "fact" | "";
const TABLES = ["dim_hospital", "fct_admission", "dim_date", "fct_condition", "dim_patient"];
const TABLE_INFO: Record<string, { name: string; es: string; gl: string; cols: string }> = {
  dim_patient: { name: "patient", es: "Una fila por paciente.", gl: "Unha fila por paciente.", cols: "patient_key · age_band · gender · area_sanitaria" },
  dim_hospital: { name: "hospital", es: "Una fila por centro.", gl: "Unha fila por centro.", cols: "organization_id · name · source_system" },
  dim_date: { name: "date", es: "Una fila por día del calendario.", gl: "Unha fila por día do calendario.", cols: "date · year · month · weekday" },
  fct_admission: { name: "admission", es: "Una fila cada vez que alguien ingresa.", gl: "Unha fila cada vez que alguén ingresa.", cols: "episode_id · patient_key · organization_id · admit_date · length_of_stay_days · is_readmission_30d" },
  fct_condition: { name: "condition", es: "Una fila cada vez que se diagnostica algo.", gl: "Unha fila cada vez que se diagnostica algo.", cols: "patient_key · diagnosis_date · condition_code" },
};
export const nm = (id: string) => TABLE_INFO[id]?.name ?? id;
// card centres in % of the canvas (mixed on purpose: the layout must not say which are facts)
const POS: Record<string, { x: number; y: number }> = {
  dim_hospital: { x: 17, y: 22 }, fct_admission: { x: 50, y: 22 }, dim_date: { x: 83, y: 22 },
  fct_condition: { x: 30, y: 78 }, dim_patient: { x: 70, y: 78 },
};
const pairKey = (a: string, b: string) => [a, b].sort().join("~");
export function StarCanvas({ lang, onSubmit, bad, initial }: Props) {
  const es = lang === "es";
  const marks = useBadMarks(bad);
  const [types0, edges0] = (initial ?? "").split("|");
  const [kinds, setKinds] = useState<Record<string, Kind>>(() => Object.fromEntries((types0 ?? "").replace(/^types:/, "").split(",").filter(Boolean).map((p) => p.split("=") as [string, Kind])));
  const [pairs, setPairs] = useState<string[]>(() => (edges0 ?? "").replace(/^edges:/, "").split(",").filter(Boolean).map((e) => { const [a, b] = e.split(">"); return pairKey(a, b); })); // unordered pairs "a~b"; the arrow direction comes from the kinds
  const [sel, setSel] = useState("");
  const [note, setNote] = useState("");
  const [drag, setDrag] = useState<{ from: string; x: number; y: number; moved: boolean } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const kind = (id: string): Kind => kinds[id] ?? "";
  const setKind = (t: string, k: Kind) => { setKinds((s) => ({ ...s, [t]: k })); marks.clear(`type:${t}`); };
  /** Join two tables (if it makes sense) and say why not otherwise. */
  const link = (a: string, b: string) => {
    setSel("");
    if (!a || !b || a === b) return;
    const ka = kind(a), kb = kind(b);
    if (!ka || !kb) { setNote(es ? `Primero decid si ${nm(!ka ? a : b)} es un hecho o una dimensión (botones de su tarjeta).` : `Primeiro decidide se ${nm(!ka ? a : b)} é un feito ou unha dimensión (botóns da súa tarxeta).`); return; }
    if (ka === kb) { setNote(ka === "dim" ? (es ? "Dos dimensiones no se unen entre sí: cada dimensión se une a un hecho." : "Dúas dimensións non se unen entre si: cada dimensión úñese a un feito.") : (es ? "Dos hechos no se unen entre sí: comparten dimensiones." : "Dous feitos non se unen entre si: comparten dimensións.")); return; }
    const k = pairKey(a, b);
    if (pairs.includes(k)) { setNote(es ? "Esas dos ya están unidas." : "Esas dúas xa están unidas."); return; }
    setPairs((p) => [...p, k]);
    const f = ka === "fact" ? a : b, d = ka === "fact" ? b : a;
    setNote(`✔ ${es ? "Unidas" : "Unidas"}: ${nm(f)} → ${nm(d)}`);
  };
  const clickCard = (id: string) => {
    if (!sel) { setSel(id); setNote(es ? `${nm(id)} elegida. Ahora pulsad la tabla con la que se une.` : `${nm(id)} escollida. Agora premede a táboa coa que se une.`); return; }
    if (sel === id) { setSel(""); setNote(""); return; }
    link(sel, id);
  };
  const edges = pairs.map((k) => {
    const [a, b] = k.split("~");
    const f = kind(a) === "fact" ? a : b, d = f === a ? b : a;
    return { key: k, source: f, target: d, ok: kind(f) === "fact" && kind(d) === "dim", wrong: marks.isBad(`edge:${f}>${d}`) };
  });
  const issues: string[] = [];
  if (TABLES.some((t) => !kind(t))) issues.push(es ? "Marcad cada tabla como hecho o dimensión." : "Marcade cada táboa como feito ou dimensión.");
  if (edges.some((e) => !e.ok)) issues.push(es ? "Hay una unión entre dos tablas del mismo tipo (en rojo): borradla con ✕." : "Hai unha unión entre dúas táboas do mesmo tipo (en vermello): borrádea con ✕.");
  const report = `types:${[...TABLES].sort().map((t) => `${t}=${kind(t)}`).join(",")}|edges:${edges.map((e) => `${e.source}>${e.target}`).sort().join(",")}`;
  useEffect(() => { setDraft("r3b_estrella", report, `Tipos: ${TABLES.map((t) => `${nm(t)}=${kind(t) === "fact" ? "hecho" : kind(t) === "dim" ? "dimensión" : "sin elegir"}`).join(", ")}. Uniones: ${edges.map((e) => `${nm(e.source)} → ${nm(e.target)}`).join(", ") || "ninguna"}.`); }, [report]); // eslint-disable-line react-hooks/exhaustive-deps
  // drag from anywhere on a card and drop it on another card (a click without moving is handled by onClick)
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 } : d));
    const up = (e: PointerEvent) => {
      const d = drag;
      setDrag(null);
      const to = (document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-table]") as HTMLElement | null)?.dataset.table ?? "";
      if (to && to !== d.from) link(d.from, to);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag?.from]); // eslint-disable-line react-hooks/exhaustive-deps
  const box = canvas.current?.getBoundingClientRect();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const removePair = (k: string) => { setPairs((p) => p.filter((x) => x !== k)); };
  return (
    <div className="star">
      <p className="hint-small">{es
        ? "1) En cada tarjeta pulsad «Hecho» o «Dimensión». 2) Para unir: pulsad una tabla y después la otra (o arrastrad de una a otra desde cualquier punto). La flecha se pone sola del hecho a la dimensión. ✕ borra una unión."
        : "1) En cada tarxeta premede «Feito» ou «Dimensión». 2) Para unir: premede unha táboa e despois a outra (ou arrastrade dunha a outra desde calquera punto). A frecha ponse soa do feito á dimensión. ✕ borra unha unión."}</p>
      <div className="starcanvas" ref={canvas}>
        <svg className="starlines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {edges.map((e) => {
            const a = POS[e.source], b = POS[e.target];
            return <line key={e.key} className={e.ok && !e.wrong ? "ok" : "bad"} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />;
          })}
          {drag?.moved && box && <line className="tmp" x1={POS[drag.from].x} y1={POS[drag.from].y} x2={((drag.x - box.left) / box.width) * 100} y2={((drag.y - box.top) / box.height) * 100} vectorEffect="non-scaling-stroke" />}
        </svg>
        {TABLES.map((t) => (
          <div key={t} data-table={t} role="button" tabIndex={0} aria-pressed={sel === t} aria-label={`${nm(t)}: ${TABLE_INFO[t][lang]}`}
            className={`tbl ${kind(t)} ${sel === t ? "sel" : ""} ${(sel && sel !== t) || (drag?.moved && drag.from !== t) ? "target" : ""} ${marks.isBad(`type:${t}`) ? "wrong" : ""}`}
            style={{ left: `${POS[t].x}%`, top: `${POS[t].y}%` }}
            onClick={() => clickCard(t)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickCard(t); } }}
            onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; e.preventDefault(); setDrag({ from: t, x: e.clientX, y: e.clientY, moved: false }); }}>
            <b>{nm(t)}</b>
            <small>{TABLE_INFO[t][lang]}</small>
            <code className="tcols">{TABLE_INFO[t].cols}</code>
            <span className="kindbtns" role="group" aria-label={`${nm(t)}: tipo`}>
              <button type="button" className={kind(t) === "fact" ? "on" : ""} aria-pressed={kind(t) === "fact"} onClick={(e) => { e.stopPropagation(); setKind(t, "fact"); }}>{es ? "Hecho" : "Feito"}</button>
              <button type="button" className={kind(t) === "dim" ? "on" : ""} aria-pressed={kind(t) === "dim"} onClick={(e) => { e.stopPropagation(); setKind(t, "dim"); }}>{es ? "Dimensión" : "Dimensión"}</button>
            </span>
          </div>
        ))}
      </div>
      <p className="starnote" aria-live="polite">{note || (es ? "Recordad: un hecho es algo que pasa y se cuenta; una dimensión lo describe. Las columnas de cada tarjeta dicen a qué se puede unir." : "Lembrade: un feito é algo que pasa e se conta; unha dimensión descríbeo. As columnas de cada tarxeta din a que se pode unir.")}</p>
      <div className="starlist">
        <b>{es ? "Uniones" : "Unións"} ({edges.length}):</b>{" "}
        {edges.length === 0 ? <span className="hint-small">{es ? "ninguna todavía" : "ningunha aínda"}</span> : edges.map((e) => (
          <span key={e.key} className={`edgechip ${e.ok && !e.wrong ? "" : "bad"}`}>{nm(e.source)} → {nm(e.target)}{e.wrong && ` ✘`} <button type="button" className="ghost" aria-label={`${es ? "Borrar" : "Borrar"} ${nm(e.source)} → ${nm(e.target)}`} onClick={() => removePair(e.key)}>✕</button></span>
        ))}
      </div>
      <details className="kbdlink">
        <summary>{es ? "Unir con menús (sin ratón)" : "Unir con menús (sen rato)"}</summary>
        <div className="row" role="group" aria-label={es ? "Unir con teclado" : "Unir con teclado"}>
          <label>{es ? "Desde" : "Desde"}<select value={from} onChange={(e) => setFrom(e.target.value)}><option value="">—</option>{TABLES.map((t) => <option key={t} value={t}>{nm(t)}</option>)}</select></label>
          <label>{es ? "Hasta" : "Ata"}<select value={to} onChange={(e) => setTo(e.target.value)}><option value="">—</option>{TABLES.map((t) => <option key={t} value={t}>{nm(t)}</option>)}</select></label>
          <button className="ghost" disabled={!from || !to || from === to} onClick={() => { link(from, to); setFrom(""); setTo(""); }}>{es ? "Unir" : "Unir"}</button>
        </div>
      </details>
      <div className="row"><button className="ghost" disabled={pairs.length === 0} onClick={() => { setPairs([]); setNote(""); }}>{es ? "Borrar todas las uniones" : "Borrar todas as unións"}</button></div>
      <ul className="err">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
      <button className="primary" disabled={issues.length > 0 || edges.length === 0} onClick={() => onSubmit(report)}>{es ? "Comprobar esquema" : "Comprobar esquema"}</button>
    </div>
  );
}

// ------------------------------------------------------------------ R4 problem cards (interviews, verdict, counts)
// Each card explains in plain words WHAT the detector saw and why it matters, never WHY it happens: the cause is what
// the team finds out in the interviews (the old «evidence board» level, where the cause was picked from a list, was
// removed on 26-nov). The figures come from the data.
type L2t = { es: string; gl: string };
const DETECTORS: { id: string; icon: string; es: string; gl: string; seen: L2t; matters: L2t; clue: string; sql: string }[] = [
  {
    id: "negative_stay", icon: "⏪", es: "Estancias negativas (alta antes del ingreso)", gl: "Estadías negativas (alta antes do ingreso)", clue: "C2",
    seen: { es: "Visitas en las que la fecha de alta es ANTERIOR a la de ingreso: según el registro, el paciente se fue antes de llegar. Hay pocas, pero salen en varios centros y en años distintos.", gl: "Visitas nas que a data de alta é ANTERIOR á de ingreso: segundo o rexistro, o paciente marchou antes de chegar. Hai poucas, pero saen en varios centros e en anos distintos." },
    matters: { es: "La duración de la estancia sale negativa y el episodio no tiene sentido.", gl: "A duración da estadía sae negativa e o episodio non ten sentido." },
    sql: "select count(*) as registros, count(distinct organization_id) as centros, min(ts)::date as desde, max(ts)::date as hasta from canon.anomalies where kind = 'negative_stay'",
  },
  {
    id: "post_mortem", icon: "🕯", es: "Visitas después del fallecimiento", gl: "Visitas despois do falecemento", clue: "C3",
    seen: { es: "Pacientes con visitas registradas DESPUÉS de su fecha de fallecimiento (la columna deathdate de pacientes). Una persona fallecida no puede ir al hospital: algo está mal apuntado.", gl: "Pacientes con visitas rexistradas DESPOIS da súa data de falecemento (a columna deathdate de pacientes). Unha persoa falecida non pode ir ao hospital: algo está mal apuntado." },
    matters: { es: "Esas visitas podrían contar como reingresos que nunca ocurrieron.", gl: "Esas visitas poderían contar como reingresos que nunca ocorreron." },
    sql: "select count(*) as registros, count(distinct patient_key) as pacientes, count(distinct organization_id) as centros, min(ts)::date as desde, max(ts)::date as hasta from canon.anomalies where kind = 'post_mortem'",
  },
  {
    id: "frag_h3", icon: "🧩", es: "Altas y reingresos el mismo día", gl: "Altas e reingresos o mesmo día", clue: "C1",
    seen: { es: "Pacientes a los que se da el alta y vuelven a ingresar ese mismo día, en el mismo centro, como si una estancia se partiera en trozos. Solo pasa en UN centro y solo a partir de una fecha: antes, nunca.", gl: "Pacientes aos que se lles dá a alta e volven ingresar ese mesmo día, no mesmo centro, coma se unha estadía se partise en anacos. Só pasa nun centro e só a partir dunha data: antes, nunca." },
    matters: { es: "Cada trozo parece un ingreso nuevo y hace subir los reingresos de ese centro.", gl: "Cada anaco parece un ingreso novo e fai subir os reingresos dese centro." },
    sql: "select count(*) as registros, count(distinct organization_id) as centros, 'H3 (' || min(organization_id) || ')' as centro, min(ts)::date as desde, max(ts)::date as hasta from canon.anomalies where kind = 'frag_h3'",
  },
];
function useDetectors() {
  const [rows, setRows] = useState<Record<string, Record<string, any>>>({});
  useEffect(() => {
    (async () => { await ensureCanon(); const eng = await getEngine(); const o: Record<string, Record<string, any>> = {}; for (const d of DETECTORS) o[d.id] = (await eng.query(d.sql))[0]; setRows(o); })().catch((e) => setRows({ _error: { error: String(e?.message ?? e).slice(0, 200) } }));
  }, []);
  return rows;
}
const show = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "number" && v > 1e11 ? new Date(v).toISOString().slice(0, 10) : String(v));
/** `clues`: in the interviews, a card whose cause the team has already found gets a check mark. */
function DetectorCards({ rows, lang, clues, children }: { rows: Record<string, Record<string, any>>; lang: Lang; clues?: string[]; children?: (id: string) => React.ReactNode }) {
  const es = lang === "es";
  return (
    <div className="detectors">
      {DETECTORS.map((d) => {
        const got = clues?.includes(d.clue);
        return (
          <article key={d.id} className={`det ${got ? "got" : ""}`}><h4>{d.icon} {es ? d.es : d.gl}</h4>
            <p className="detseen">{d.seen[lang]}</p>
            <p className="detnums">{rows._error ? <span className="err">{String(rows._error.error)}</span> : rows[d.id] ? Object.entries(rows[d.id]).map(([k, v]) => <span key={k}><small>{k}</small> <b>{show(v)}</b>{"  "}</span>) : "…"}</p>
            <p className="detmatters"><b>{es ? "Por qué importa:" : "Por que importa:"}</b> {d.matters[lang]}</p>
            {clues && <p className={`detcause ${got ? "got" : ""}`}>{got ? (es ? "✔ Ya sabéis por qué pasa (está en la conversación)" : "✔ Xa sabedes por que pasa (está na conversa)") : (es ? "❓ ¿Por qué pasa? Aún no lo sabéis" : "❓ Por que pasa? Aínda non o sabedes")}</p>}
            {children?.(d.id)}
          </article>
        );
      })}
    </div>
  );
}
export function VerdictForm({ lang, onSubmit, bad, initial }: Props) {
  const rows = useDetectors();
  const marks = useBadMarks(bad);
  const [c, setC] = useState<Record<string, string>>(() => kvOf(initial));
  setDraft("r4c_veredicto", DETECTORS.filter((d) => c[d.id]).map((d) => `${d.id}=${c[d.id]}`).join(";"), `Tratamientos elegidos: ${DETECTORS.map((d) => `${d.es} → ${c[d.id] ?? "(sin elegir)"}`).join("; ")}`);
  const opts = [["fix_rule", lang === "es" ? "Corregir con una regla" : "Corrixir cunha regra"], ["exclude_document", lang === "es" ? "Excluir y documentar" : "Excluír e documentar"], ["exclude_escalate", lang === "es" ? "Excluir y escalar al hospital" : "Excluír e escalar ao hospital"], ["document", lang === "es" ? "Ya cubierto por la fusión de episodios: documentar" : "Xa cuberto pola fusión de episodios: documentar"]];
  return (
    <div>
      <DetectorCards rows={rows} lang={lang}>{(id) => (
        <label>{lang === "es" ? "Tratamiento" : "Tratamento"}<select className={marks.isBad(id) ? "wrong" : ""} value={c[id] ?? ""} onChange={(e) => { setC({ ...c, [id]: e.target.value }); marks.clear(id); }}><option value="">—</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      )}</DetectorCards>
      <button className="primary" disabled={DETECTORS.some((d) => !c[d.id])} onClick={() => onSubmit([...DETECTORS.map((d) => d.id)].sort().map((id) => `${id}=${c[id]}`).join(";"))}>{lang === "es" ? "Dictar veredicto" : "Ditar veredicto"}</button>
    </div>
  );
}
export function EvidenceCounts({ lang, clues }: { lang: Lang; clues?: string[] }) {
  const rows = useDetectors();
  return <DetectorCards rows={rows} lang={lang} clues={clues} />;
}

// ------------------------------------------------------------------ R5A KPI form
// The minimum of discharges is chosen looking at the real volumes (any sensible value is valid; the server checks it).
type Center = { centro: string; altas: number; reingresos: number; tasa: number };
export function KpiForm({ lang, onSubmit, bad, teamId, initial }: Props & { teamId: string }) {
  const es = lang === "es";
  const marks = useBadMarks(bad);
  const [a, setA] = useState<Record<string, string>>(() => { const m = kvOf(initial); if (m.min_n) m.min_n = m.min_n.replace(/^n/, ""); return m; });
  const [centers, setCenters] = useState<Center[]>([]);
  useEffect(() => {
    (async () => { await ensureCanon(); setCenters((await (await getEngine()).query("select organization_name as centro, count(*)::int as altas, sum(is_readmission_30d::int)::int as reingresos, round(100.0 * sum(is_readmission_30d::int) / count(*), 1) as tasa from canon.fct_admission_clean group by 1 order by 2")).map((r) => ({ centro: String(r.centro), altas: Number(r.altas), reingresos: Number(r.reingresos), tasa: Number(r.tasa) }))); })().catch(() => {});
  }, []);
  const set = (id: string, v: string) => { setA({ ...a, [id]: v }); marks.clear(id); };
  const Q: { id: string; label: string; o: [string, string][] }[] = [
    { id: "kpi", label: es ? "¿Cómo se calcula la tasa?" : "Como se calcula a taxa?", o: [["readmit_over_discharges", es ? "Reingresos a 30 días / altas del periodo" : "Reingresos a 30 días / altas do período"], ["readmit_over_patients", es ? "Reingresos / pacientes del hospital" : "Reingresos / pacientes do hospital"], ["readmit_count", es ? "Solo el número de reingresos" : "Só o número de reingresos"]] },
    { id: "small_center", label: es ? "Clínica Illas Cíes (3 ingresos, 100 %): ¿qué hacemos?" : "Clínica Illas Cíes (3 ingresos, 100 %): que facemos?", o: [["show", es ? "Mostrarla como las demás" : "Amosala como as demais"], ["hide", es ? "Ocultarla sin decir nada" : "Agochala sen dicir nada"], ["pool", es ? "Agruparla con otros centros pequeños" : "Agrupala con outros centros pequenos"], ["warn", es ? "Mostrarla aparte, con un aviso de pocos casos" : "Amosala á parte, cun aviso de poucos casos"]] },
  ];
  const min = Number(a.min_n);
  const minOk = a.min_n !== undefined && a.min_n !== "" && Number.isFinite(min) && min >= 1;
  const published = minOk ? centers.filter((c) => c.altas >= min).length : centers.length;
  const report = `kpi=${a.kpi ?? ""};min_n=${minOk ? Math.round(min) : ""};small_center=${a.small_center ?? ""}`;
  setDraft("r5a_kpi", report, `Indicador: tasa → ${Q[0].o.find(([v]) => v === a.kpi)?.[1] ?? "(sin elegir)"}; mínimo de altas → ${minOk ? min : "(sin elegir)"} (se publicarían ${published} de ${centers.length} centros); centro pequeño → ${Q[1].o.find(([v]) => v === a.small_center)?.[1] ?? "(sin elegir)"}`);
  return (
    <div className="kpiform">
      <h4>{es ? "Altas y reingresos de cada centro" : "Altas e reingresos de cada centro"}</h4>
      <table className="prev"><thead><tr><th>{es ? "Centro" : "Centro"}</th><th>{es ? "Altas" : "Altas"}</th><th>{es ? "Reingresos" : "Reingresos"}</th><th>{es ? "Tasa" : "Taxa"}</th><th>{es ? "1 reingreso más mueve la tasa…" : "1 reingreso máis move a taxa…"}</th>{minOk && <th>{es ? "¿Se publica?" : "Publícase?"}</th>}</tr></thead>
        <tbody>{centers.map((c) => <tr key={c.centro}><td>{c.centro}</td><td>{c.altas}</td><td>{c.reingresos}</td><td>{c.tasa} %</td><td>{(100 / c.altas).toFixed(1)} {es ? "puntos" : "puntos"}</td>{minOk && <td>{c.altas >= min ? "✔" : "—"}</td>}</tr>)}</tbody>
      </table>
      <label>{Q[0].label}<select className={marks.isBad("kpi") ? "wrong" : ""} value={a.kpi ?? ""} onChange={(e) => set("kpi", e.target.value)}><option value="">—</option>{Q[0].o.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>{es ? "¿A partir de cuántas altas es fiable la tasa de un centro? (mirad la última columna)" : "A partir de cantas altas é fiable a taxa dun centro? (mirade a última columna)"}
        <input type="number" min={1} max={2000} className={marks.isBad("min_n") ? "wrong" : ""} value={a.min_n ?? ""} onChange={(e) => set("min_n", e.target.value)} aria-label={es ? "Mínimo de altas" : "Mínimo de altas"} />
      </label>
      {minOk && <p className="hint-small">{es ? `Con ese mínimo se publican ${published} de ${centers.length} centros.` : `Con ese mínimo publícanse ${published} de ${centers.length} centros.`}</p>}
      <label>{Q[1].label}<select className={marks.isBad("small_center") ? "wrong" : ""} value={a.small_center ?? ""} onChange={(e) => set("small_center", e.target.value)}><option value="">—</option>{Q[1].o.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <button className="primary" disabled={!a.kpi || !minOk || !a.small_center} onClick={async () => { toolState.save(teamId, "kpi_min", String(Math.round(min))); await onSubmit(report); }}>{es ? "Fijar el indicador" : "Fixar o indicador"}</button>
    </div>
  );
}
