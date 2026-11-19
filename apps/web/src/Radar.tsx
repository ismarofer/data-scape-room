import { useEffect, useState } from "react";
import type { Lang } from "@codigo-alta/shared";
import { fetchRaw } from "./duck";
import { setDraft } from "./workContext";

const ACTIONS = ["remove", "pseudonymize", "keep", "generalize"] as const;
type Action = (typeof ACTIONS)[number];
const LABEL: Record<Action, { es: string; gl: string; icon: string }> = {
  remove: { es: "Eliminar", gl: "Eliminar", icon: "🗑" },
  pseudonymize: { es: "Pseudonimizar (hash con sal)", gl: "Pseudonimizar (hash con sal)", icon: "🔑" },
  keep: { es: "Mantener", gl: "Manter", icon: "✔" },
  generalize: { es: "Generalizar (tramo / área)", gl: "Xeneralizar (tramo / área)", icon: "🔍" },
};

/** Drag-and-drop with a keyboard alternative: every chip has a menu to move it. */
type Bad = { col: string; kind: string };
const WHY: Record<string, { es: string; gl: string }> = {
  critical: { es: "identifica directamente a una persona: no puede quedar en claro", gl: "identifica directamente a unha persoa: non pode quedar en claro" },
  blocking: { es: "hace falta para unir fichas duplicadas más adelante: no la elimines del todo", gl: "fai falta para unir fichas duplicadas máis adiante: non a elimines do todo" },
  warn: { es: "hay un tratamiento mejor para esta columna", gl: "hai un tratamento mellor para esta columna" },
  missing: { es: "sin clasificar", gl: "sen clasificar" },
};
export function PrivacyRadar({ lang, onSubmit }: { lang: Lang; onSubmit: (report: string) => Promise<{ badColumns?: Bad[] } | void> }) {
  const es = lang === "es";
  const [cols, setCols] = useState<{ name: string; example: string }[]>([]);
  const [place, setPlace] = useState<Record<string, Action | "">>({});
  const [drag, setDrag] = useState("");
  const [bad, setBad] = useState<Bad[]>([]);
  useEffect(() => {
    fetchRaw("patients.csv").then((b) => {
      const lines = new TextDecoder().decode(b.subarray(0, 4000)).split("\n");
      const head = lines[0].split(",");
      const row = lines[1].split(",");
      setCols(head.map((h, i) => ({ name: h.trim(), example: (row[i] ?? "").slice(0, 28) })));
    });
  }, []);
  const move = (c: string, a: Action | "") => { setPlace((p) => ({ ...p, [c]: a })); setBad((b) => b.filter((x) => x.col !== c)); };
  const pool = cols.filter((c) => !place[c.name]);
  const chip = (c: { name: string; example: string }) => (
    <li key={c.name} className={`chip ${bad.find((b) => b.col === c.name) ? "wrong" : ""}`} draggable onDragStart={() => setDrag(c.name)}>
      <span><b>{c.name}</b> <small>{c.example}</small></span>
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
          <small>{es ? "Pista: consulta docs/guia-privacidad.md (tabla de las 19 columnas)." : "Pista: consulta docs/guia-privacidad.md (táboa das 19 columnas)."}</small>
        </div>
      )}
    </div>
  );
}
