import { useEffect, useState } from "react";
import type { Lang } from "@codigo-alta/shared";
import { emit, setDraft } from "./workContext";

// Where to start checking each claim: a table and a kind of question (never the conclusion). The team still picks the column and conditions.
const PRESET: Record<string, { table: string; op: string; col?: string; es: string; gl: string }> = {
  c1: { table: "organizations", op: "rows", es: "tabla de centros · contar filas", gl: "táboa de centros · contar filas" },
  c2: { table: "encounters", op: "rows", es: "visitas · contar filas (añadid condiciones)", gl: "visitas · contar filas (engadide condicións)" },
  c3: { table: "patients", op: "distinct", es: "pacientes · valores distintos (elegid la columna)", gl: "pacientes · valores distintos (elixide a columna)" },
  c4: { table: "encounters", op: "minmax", col: "start_ts", es: "visitas · más pequeño y más grande de start_ts", gl: "visitas · máis pequeno e máis grande de start_ts" },
  c5: { table: "encounters", op: "distinct", col: "encounter_id", es: "visitas · valores distintos (añadid una condición)", gl: "visitas · valores distintos (engadide unha condición)" },
  c6: { table: "encounters", op: "not_in", col: "patient_id", es: "visitas cuyo paciente no está en la tabla patients", gl: "visitas cuxo paciente non está na táboa patients" },
};

interface Claim { id: string; text: { es: string; gl: string } }

export function VerifyPanel({ teamId, lockId, lang, onSubmit }: { teamId: string; lockId: string; lang: Lang; onSubmit: (report: string) => Promise<void> }) {
  const es = lang === "es";
  const [data, setData] = useState<{ claims: Claim[] } | null>(null);
  const [flag, setFlag] = useState<Record<string, boolean>>({});
  useEffect(() => { fetch(`/api/verify/${lockId}`).then((r) => r.json()).then(setData).catch(() => {}); }, [lockId]);
  if (!data) return <p>…</p>;

  const flagged = Object.keys(flag).filter((k) => flag[k]);
  setDraft(lockId, [...flagged].sort().join(";"), flagged.length ? `Afirmaciones marcadas como falsas: ${flagged.map((x) => x.slice(1)).join(", ")}` : "Aún no han marcado ninguna afirmación");
  const ready = flagged.length > 0;
  return (
    <>
    <div className="answerbox"><b>✍️ {es ? "Qué tenéis que hacer aquí" : "Que tedes que facer aquí"}</b>
      <p>{es ? "Pulsad «🔬 Comprobar» en una afirmación: el Laboratorio de abajo se prepara. Comparad su resultado con lo que dice Ada y marcad ✔ SOLO las que sean falsas." : "Premede «🔬 Comprobar» nunha afirmación: o Laboratorio de abaixo prepárase. Comparade o seu resultado co que di Ada e marcade ✔ SÓ as que sexan falsas."}</p></div>
    <div className="verify">
      <section aria-label={es ? "Afirmaciones de Ada" : "Afirmacións de Ada"}>
        <h3>🤖 Ada <small className="ai-tag">{es ? "Personaje con IA · puede equivocarse" : "Personaxe con IA · pode equivocarse"}</small></h3>
        <ul className="claims">
          {data.claims.map((c) => (
            <li key={c.id}>
              <label className="check"><input type="checkbox" checked={!!flag[c.id]} onChange={(e) => setFlag({ ...flag, [c.id]: e.target.checked })} /> <b>{c.id.slice(1)}. {c.text[lang]}</b> <small className="hint-small">{flag[c.id] ? (es ? "← marcada como FALSA" : "← marcada como FALSA") : ""}</small></label>
              {PRESET[c.id] && <button type="button" className="ghost small" onClick={() => { const p = PRESET[c.id]; emit({ type: "lab:preset", table: p.table, op: p.op, col: p.col }); document.querySelector(".lab")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>🔬 {es ? "Comprobar" : "Comprobar"} <small>({PRESET[c.id][lang]})</small></button>}
            </li>
          ))}
        </ul>
        <button className="primary" disabled={!ready} onClick={() => onSubmit([...flagged].sort().join(";"))}>{es ? "Entregar auditoría" : "Entregar auditoría"}</button>
      </section>
    </div>
    </>
  );
}
