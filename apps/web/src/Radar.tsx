import { useEffect, useState } from "react";
import { parseCsv, type Lang } from "@codigo-alta/shared";
import { fetchRaw } from "./duck";
import { setDraft } from "./workContext";

const ACTIONS = ["remove", "pseudonymize", "keep", "generalize"] as const;
type Action = (typeof ACTIONS)[number];
export const LABEL: Record<Action, { es: string; gl: string; icon: string }> = {
  remove: { es: "Eliminar", gl: "Eliminar", icon: "🗑" },
  pseudonymize: { es: "Pseudonimizar (hash con sal)", gl: "Pseudonimizar (hash con sal)", icon: "🔑" },
  keep: { es: "Mantener", gl: "Manter", icon: "✔" },
  generalize: { es: "Generalizar (tramo / área)", gl: "Xeneralizar (tramo / área)", icon: "🔍" },
};

/**
 * Only the columns worth deciding (2 per action, more or less). The other columns of patients.csv are not used anywhere
 * in the project: they are shown as already removed so nobody has to classify eleven obvious ones.
 * What each column holds and how risky it is (not what to do: that is the level).
 */
const COL_INFO: Record<string, { es: string; gl: string }> = {
  patient_id: { es: "código interno de la ficha · riesgo bajo · une la ficha con sus visitas", gl: "código interno da ficha · risco baixo · une a ficha coas súas visitas" },
  ssn: { es: "nº de identificación · riesgo MUY alto · pero hace falta para saber qué fichas son la misma persona", gl: "nº de identificación · risco MOI alto · pero fai falta para saber que fichas son a mesma persoa" },
  first_name: { es: "nombre · riesgo alto · no hace falta para medir", gl: "nome · risco alto · non fai falta para medir" },
  address: { es: "calle y número · riesgo MUY alto · no hace falta", gl: "rúa e número · risco MOI alto · non fai falta" },
  birthdate: { es: "fecha exacta de nacimiento · la edad sí importa, el día exacto no", gl: "data exacta de nacemento · a idade si importa, o día exacto non" },
  postal_code: { es: "código postal · sirve para saber la zona, pero junto a nacimiento y sexo identifica", gl: "código postal · serve para saber a zona, pero xunto a nacemento e sexo identifica" },
  gender: { es: "sexo · riesgo bajo · útil para comprobar que el análisis es justo", gl: "sexo · risco baixo · útil para comprobar que a análise é xusta" },
  deathdate: { es: "fecha de fallecimiento · el protocolo la necesita para excluir registros", gl: "data de falecemento · o protocolo precísaa para excluír rexistros" },
};
const DECIDE = Object.keys(COL_INFO);
/** Drag-and-drop with a keyboard alternative: every chip has a menu to move it. */
type Bad = { col: string; kind: string };
const WHY: Record<string, { es: string; gl: string }> = {
  critical: { es: "identifica directamente a una persona: no puede quedar en claro", gl: "identifica directamente a unha persoa: non pode quedar en claro" },
  blocking: { es: "hace falta para unir fichas duplicadas más adelante: no la elimines del todo", gl: "fai falta para unir fichas duplicadas máis adiante: non a elimines do todo" },
  warn: { es: "hay un tratamiento mejor para esta columna", gl: "hai un tratamento mellor para esta columna" },
  missing: { es: "sin clasificar", gl: "sen clasificar" },
};
/** `initial`: a delivered report ("col=action;…") to show a solved level read-only. */
export function PrivacyRadar({ lang, onSubmit, initial }: { lang: Lang; onSubmit: (report: string) => Promise<{ badColumns?: Bad[] } | void>; initial?: string }) {
  const es = lang === "es";
  const [cols, setCols] = useState<{ name: string; example: string }[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const [place, setPlace] = useState<Record<string, Action | "">>(() => Object.fromEntries((initial ?? "").split(";").filter(Boolean).map((p) => p.split("=") as [string, Action])));
  const [drag, setDrag] = useState("");
  const [bad, setBad] = useState<Bad[]>([]);
  useEffect(() => {
    fetchRaw("patients.csv").then((b) => {
      const [h, r] = parseCsv(new TextDecoder().decode(b.subarray(0, 4000)), ","); // quoted fields may hold commas
      const head = h.cells, row = r?.cells ?? [];
      const all = head.map((h, i) => ({ name: h.trim(), example: (row[i] ?? "").slice(0, 28) }));
      setCols(DECIDE.map((n) => all.find((c) => c.name === n) ?? { name: n, example: "" }));
      setGone(all.map((c) => c.name).filter((n) => !DECIDE.includes(n)));
    });
  }, []);
  const move = (c: string, a: Action | "") => { setPlace((p) => ({ ...p, [c]: a })); setBad((b) => b.filter((x) => x.col !== c)); };
  const pool = cols.filter((c) => !place[c.name]);
  const chip = (c: { name: string; example: string }) => (
    <li key={c.name} className={`chip ${bad.find((b) => b.col === c.name) ? "wrong" : ""}`} draggable onDragStart={() => setDrag(c.name)}>
      <span><b>{c.name}</b> <small>{c.example}</small>{COL_INFO[c.name] && <span className="colinfo">{COL_INFO[c.name][lang]}</span>}</span>
      <select aria-label={`${es ? "Mover" : "Mover"} ${c.name}`} value={place[c.name] ?? ""} onChange={(e) => move(c.name, e.target.value as Action | "")}>
        <option value="">{es ? "Sin clasificar" : "Sen clasificar"}</option>
        {ACTIONS.map((a) => <option key={a} value={a}>{LABEL[a][lang]}</option>)}
      </select>
    </li>
  );
  const done = cols.length > 0 && pool.length === 0;
  useEffect(() => {
    const placed = cols.filter((c) => place[c.name]);
    setDraft("r2a_radar", cols.map((c) => `${c.name}=${place[c.name] ?? ""}`).filter((x) => !x.endsWith("=")).join(";"), placed.length ? `Columnas ya clasificadas: ${placed.map((c) => `${c.name} → ${LABEL[place[c.name] as Action].es}`).join(", ")}. Sin clasificar: ${pool.map((c) => c.name).join(", ") || "ninguna"}.` : "Aún no han clasificado ninguna columna.");
  }, [place, cols]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="radar">
      <div className="rules" aria-label={es ? "Cómo decidir" : "Como decidir"}>
        <div>🗑 <b>{es ? "Eliminar" : "Eliminar"}</b>: {es ? "identifica o no hace falta para nada." : "identifica ou non fai falta para nada."}</div>
        <div>🔑 <b>{es ? "Pseudonimizar" : "Pseudonimizar"}</b>: {es ? "identifica, pero hace falta para unir fichas." : "identifica, pero fai falta para unir fichas."}</div>
        <div>🔍 <b>{es ? "Generalizar" : "Xeneralizar"}</b>: {es ? "útil, pero demasiado exacta." : "útil, pero demasiado exacta."}</div>
        <div>✔ <b>{es ? "Mantener" : "Manter"}</b>: {es ? "no identifica y sirve." : "non identifica e serve."}</div>
      </div>
      {gone.length > 0 && (
        <p className="gonecols">✂️ {es ? `Noa ya ha quitado ${gone.length} columnas que el proyecto no usa para nada (documentos, nombre completo, GPS, estado civil…): ` : `Noa xa quitou ${gone.length} columnas que o proxecto non usa para nada (documentos, nome completo, GPS, estado civil…): `}<code>{gone.join(", ")}</code>. {es ? "Quedan estas 8: decidid qué hacer con cada una." : "Quedan estas 8: decidide que facer con cada unha."}</p>
      )}
      <div className="bin pool" onDragOver={(e) => e.preventDefault()} onDrop={() => drag && move(drag, "")}>
        <h4>{es ? "Columnas de pacientes" : "Columnas de pacientes"} ({pool.length})</h4>
        <ul>{pool.map(chip)}</ul>
      </div>
      <div className="bins">
        {ACTIONS.map((a) => (
          <div key={a} className={`bin b-${a}`} onDragOver={(e) => e.preventDefault()} onDrop={() => drag && move(drag, a)} aria-label={LABEL[a][lang]}>
            <h4>{LABEL[a].icon} {LABEL[a][lang]}</h4>
            <ul>{cols.filter((c) => place[c.name] === a).map(chip)}</ul>
          </div>
        ))}
      </div>
      <button className="primary" disabled={!done} onClick={async () => { const r = await onSubmit(cols.map((c) => `${c.name}=${place[c.name]}`).join(";")); setBad((r && r.badColumns) || []); }}>{es ? "Aplicar decisiones" : "Aplicar decisións"}</button>
      {bad.length > 0 && (
        <div className="badcols" role="alert">
          <b>⚠ {es ? "Revisa estas columnas (las marcadas en rojo):" : "Revisa estas columnas (as marcadas en vermello):"}</b>
          <ul>{bad.map((b) => <li key={b.col}><code>{b.col}</code>: {(WHY[b.kind] ?? WHY.warn)[lang]}</li>)}</ul>
          <small>{es ? "Pista: consulta docs/guia-privacidad.md (tabla de las 8 columnas)." : "Pista: consulta docs/guia-privacidad.md (táboa das 8 columnas)."}</small>
        </div>
      )}
    </div>
  );
}
