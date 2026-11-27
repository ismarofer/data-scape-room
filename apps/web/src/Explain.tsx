import { useState } from "react";
import type { Lang, LockStateView } from "@codigo-alta/shared";

type Guide = NonNullable<LockStateView["guide"]>;

/**
 * The steps of a level (always visible, short) and «Saber más» (folded): why it matters, the job behind it and the words used.
 * Same layout in every level, so the team always knows where to look.
 */
export function GuidePanel({ guide, lang }: { guide: Guide; lang: Lang; memoKey?: string }) {
  const es = lang === "es";
  return (
    <>
      <section className="steps-card" data-tour="steps" aria-label={es ? "Pasos" : "Pasos"}>
        <b>👣 {es ? "Pasos" : "Pasos"}</b>
        <ol>{guide.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </section>
      <details className="guide more">
        <summary>📚 {es ? "Saber más: por qué importa y palabras clave" : "Saber máis: por que importa e palabras clave"}</summary>
        <p><b>{es ? "Para qué sirve:" : "Para que serve:"}</b> {guide.goal}</p>
        <p><b>{es ? "En la vida real:" : "Na vida real:"}</b> {guide.why}</p>
        {guide.job && <p className="job">👩‍💻 <b>{es ? "Profesión:" : "Profesión:"}</b> {guide.job}</p>}
        {guide.terms.length > 0 && <dl>{guide.terms.map((t) => <div key={t.term}><dt>{t.term}</dt><dd>{t.def}</dd></div>)}</dl>}
      </details>
    </>
  );
}

export function GlossaryPanel({ entries, lang }: { entries: { term: string; def: string }[]; lang: Lang }) {
  const es = lang === "es";
  const [q, setQ] = useState("");
  const shown = entries.filter((e) => (e.term + e.def).toLowerCase().includes(q.toLowerCase()));
  return (
    <details className="pop">
      <summary className="ghost btnlike">📖 {es ? "Glosario" : "Glosario"}</summary>
      <div className="popbody">
        <h3>{es ? "Glosario" : "Glosario"}</h3>
        <input aria-label={es ? "Buscar en el glosario" : "Buscar no glosario"} placeholder={es ? "Buscar…" : "Buscar…"} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%" }} />
        <dl>{shown.map((e) => <div key={e.term}><dt>{e.term}</dt><dd>{e.def}</dd></div>)}</dl>
      </div>
    </details>
  );
}

export function MetersLegend({ lang }: { lang: Lang }) {
  const es = lang === "es";
  const rows: [string, string][] = es
    ? [
        ["⭐ Confianza de la Comisión", "El único medidor del juego (0-100): cuánto se fía la Comisión de vuestro trabajo. Sube al superar cada nivel y con decisiones prudentes y honestas. Baja al usar a Lumi (−1 por pregunta, −5 por pista, −10 la solución), al marcar algo falso, al dejar datos personales a la vista o con atajos."],
        ["⏱ Tiempo", "Lo que queda hasta las 13:00, cuando se reúne la Comisión."],
        ["", "Cada vez que cambia, veréis un aviso con la subida o la bajada y el motivo. Al final, la Comisión la tiene en cuenta junto a vuestras respuestas."],
      ]
    : [
        ["⭐ Confianza da Comisión", "O único medidor do xogo (0-100): canto se fía a Comisión do voso traballo. Sobe ao superar cada nivel e con decisións prudentes e honestas. Baixa ao usar a Lumi (−1 por pregunta, −5 por pista, −10 a solución), ao marcar algo falso, ao deixar datos persoais á vista ou con atallos."],
        ["⏱ Tempo", "O que queda ata as 13:00, cando se reúne a Comisión."],
        ["", "Cada vez que cambia, veredes un aviso coa subida ou a baixada e o motivo. Ao final, a Comisión tena en conta xunto ás vosas respostas."],
      ];
  return (
    <details className="pop" data-tour="meterhelp">
      <summary className="ghost btnlike" aria-label={es ? "Qué significa el medidor" : "Que significa o medidor"}>❓ {es ? "Confianza" : "Confianza"}</summary>
      <div className="popbody"><h3>{es ? "¿Qué es la confianza?" : "Que é a confianza?"}</h3><dl>{rows.map(([a, b], i) => <div key={i}>{a && <dt>{a}</dt>}<dd>{b}</dd></div>)}</dl></div>
    </details>
  );
}
