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
        ["🏆 Puntos", "Suben al abrir cada candado. Bajan al pedir ayudas a Lumi o al marcar algo falso. Sirven para cerrar el juego, no para competir."],
        ["⏱ Tiempo", "Lo que queda hasta las 13:00, cuando se reúne la Comisión."],
        ["🤝 Confianza", "Cuánto se fía la Comisión de vosotros. Sube con decisiones prudentes y honestas; baja con atajos."],
        ["🛡 Cumplimiento", "Qué bien protegéis los datos personales (RGPD). Baja si dejáis datos que identifican a alguien."],
        ["🧹 Calidad de datos", "Lo limpios y fiables que están vuestros datos. Sube al limpiar bien."],
        ["", "Cada vez que algo cambia, veréis un aviso con la subida o la bajada y el motivo. La Comisión tendrá en cuenta la confianza y la calidad al final."],
      ]
    : [
        ["🏆 Puntos", "Soben ao abrir cada cadeado. Baixan ao pedir axudas a Lumi ou ao marcar algo falso. Serven para pechar o xogo, non para competir."],
        ["⏱ Tempo", "O que queda ata as 13:00, cando se reúne a Comisión."],
        ["🤝 Confianza", "Canto se fía a Comisión de vós. Sobe con decisións prudentes e honestas; baixa con atallos."],
        ["🛡 Cumprimento", "Que ben protexedes os datos persoais (RXPD). Baixa se deixades datos que identifican a alguén."],
        ["🧹 Calidade de datos", "Que limpos e fiables están os vosos datos. Sobe ao limpar ben."],
        ["", "Cada vez que algo cambia, veredes un aviso coa subida ou a baixada e o motivo. A Comisión terá en conta a confianza e a calidade ao final."],
      ];
  return (
    <details className="pop" data-tour="meterhelp">
      <summary className="ghost btnlike" aria-label={es ? "Qué significan los medidores" : "Que significan os medidores"}>❓ {es ? "Medidores" : "Medidores"}</summary>
      <div className="popbody"><h3>{es ? "¿Qué significa cada medidor?" : "Que significa cada medidor?"}</h3><dl>{rows.map(([a, b], i) => <div key={i}>{a && <dt>{a}</dt>}<dd>{b}</dd></div>)}</dl></div>
    </details>
  );
}
