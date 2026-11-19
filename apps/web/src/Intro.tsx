import { useState } from "react";
import type { Lang } from "@codigo-alta/shared";

type L2 = { es: string; gl: string };
interface Screen { icon: string; title: L2; body: L2[]; extra?: "rooms" | "rules" }

// Short on purpose: four screens of story, then the tour shows the screen itself (Tour.tsx).
const ROOMS: { n: string; icon: string; es: string; gl: string }[] = [
  { n: "1", icon: "📥", es: "Ingesta", gl: "Inxesta" },
  { n: "2", icon: "🏗️", es: "Modelado", gl: "Modelado" },
  { n: "3", icon: "🔎", es: "Calidad", gl: "Calidade" },
  { n: "4", icon: "📊", es: "Visualización", gl: "Visualización" },
  { n: "5", icon: "🤖", es: "Predicción (bonus)", gl: "Predición (bonus)" },
  { n: "F", icon: "🏛️", es: "Presentación", gl: "Presentación" },
];
const SCREENS: Screen[] = [
  {
    icon: "🏥",
    title: { es: "Hospital Costa Atlántica · 10:00", gl: "Hospital Costa Atlántica · 10:00" },
    body: [
      { es: "Cada vez más pacientes vuelven a ingresar pocos días después de recibir el alta. Eso se llama reingreso, y es mala señal.", gl: "Cada vez máis pacientes volven ingresar poucos días despois de recibir a alta. Iso chámase reingreso, e é mal sinal." },
      { es: "A las 13:00 la Comisión de Calidad quiere saber cuánto ha subido de verdad y qué hacer. Problema: los datos están hechos un lío y nadie se fía de ellos.", gl: "Ás 13:00 a Comisión de Calidade quere saber canto subiu de verdade e que facer. Problema: os datos están feitos un lío e ninguén se fía deles." },
      { es: "Todo es inventado: las personas y los centros no existen.", gl: "Todo é inventado: as persoas e os centros non existen." },
    ],
  },
  {
    icon: "🕵️",
    title: { es: "Sois el equipo de datos", gl: "Sodes o equipo de datos" },
    body: [
      { es: "Vais a hacer, en pequeño, lo mismo que un equipo de datos de verdad. Cada sala es una etapa del trabajo:", gl: "Ides facer, en pequeno, o mesmo que un equipo de datos de verdade. Cada sala é unha etapa do traballo:" },
    ],
    extra: "rooms",
  },
  {
    icon: "🔐",
    title: { es: "Cómo se avanza", gl: "Como se avanza" },
    body: [
      { es: "Cada sala tiene varios niveles (candados). Se abren resolviendo una tarea con los datos: cargar ficheros, elegir opciones, contestar preguntas o escribir un código.", gl: "Cada sala ten varios niveis (cadeados). Ábrense resolvendo unha tarefa cos datos: cargar ficheiros, elixir opcións, contestar preguntas ou escribir un código." },
      { es: "Equivocarse no pasa nada: probad las veces que haga falta. Si os atascáis, Lumi (la IA de la derecha) os ayuda. Sus pistas cuestan algunos puntos.", gl: "Equivocarse non pasa nada: probade as veces que faga falta. Se vos atascades, Lumi (a IA da dereita) axúdavos. As súas pistas custan algúns puntos." },
    ],
  },
  {
    icon: "🤝",
    title: { es: "Reglas del juego", gl: "Regras do xogo" },
    body: [],
    extra: "rules",
  },
];
const RULES: L2[] = [
  { es: "Hablad entre vosotros: se decide en equipo.", gl: "Falade entre vós: decídese en equipo." },
  { es: "La IA ayuda, pero puede equivocarse: comprobad con los datos.", gl: "A IA axuda, pero pode equivocarse: comprobade cos datos." },
  { es: "Nunca escribáis datos personales vuestros en un chat.", gl: "Nunca escribades datos persoais vosos nun chat." },
  { es: "Varios portátiles con el mismo nombre de equipo ven lo mismo.", gl: "Varios portátiles co mesmo nome de equipo ven o mesmo." },
];

export function Intro({ lang, onDone }: { lang: Lang; onDone: () => void }) {
  const [i, setI] = useState(0);
  const s = SCREENS[i], last = i === SCREENS.length - 1, es = lang === "es";
  return (
    <section className="intro" aria-label={es ? "Introducción" : "Introdución"}>
      <div className="icon" aria-hidden="true">{s.icon}</div>
      <h2>{s.title[lang]}</h2>
      {s.body.map((p, j) => <p key={j}>{p[lang]}</p>)}
      {s.extra === "rooms" && <ol className="cycle">{ROOMS.map((r) => <li key={r.n}><span aria-hidden="true">{r.icon}</span> {r.n === "F" ? (es ? "Final" : "Final") : `${es ? "Sala" : "Sala"} ${r.n}`} · <b>{r[lang]}</b></li>)}</ol>}
      {s.extra === "rules" && <ol className="rules">{RULES.map((r, j) => <li key={j}>{r[lang]}</li>)}</ol>}
      <div className="intronav">
        <div className="steps" aria-hidden="true">{SCREENS.map((_, j) => <span key={j} className={`dot ${j === i ? "on" : ""}`} />)}</div>
        <div className="row" style={{ justifyContent: "center", alignItems: "center", gap: "1rem" }}>
          <button className="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>{es ? "Atrás" : "Atrás"}</button>
          <span aria-live="polite">{i + 1} / {SCREENS.length}</span>
          <button className="primary" autoFocus onClick={() => (last ? onDone() : setI(i + 1))}>{last ? (es ? "Ver la pantalla ▶" : "Ver a pantalla ▶") : (es ? "Siguiente" : "Seguinte")}</button>
        </div>
      </div>
    </section>
  );
}
