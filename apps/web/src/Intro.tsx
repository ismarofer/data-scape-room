import { useState } from "react";
import type { Lang } from "@codigo-alta/shared";

type L2 = { es: string; gl: string };
interface Screen { icon: string; title: L2; body: L2[]; extra?: "rooms" | "rules" }

// Four screens of story (enough context to understand the case), then the tour shows the screen itself (Tour.tsx).
const ROOMS: { icon: string; tag: L2; name: L2; what: L2 }[] = [
  { icon: "📥", tag: { es: "Sala 1", gl: "Sala 1" }, name: { es: "Ingesta", gl: "Inxesta" },
    what: { es: "Recoger los datos que llegan de cada hospital y cargarlos bien, sin perder ni duplicar nada y protegiendo los datos personales.", gl: "Recoller os datos que chegan de cada hospital e cargalos ben, sen perder nin duplicar nada e protexendo os datos persoais." } },
  { icon: "🏗️", tag: { es: "Sala 2", gl: "Sala 2" }, name: { es: "Modelado", gl: "Modelado" },
    what: { es: "Ordenar la información: decidir cómo se conectan las tablas entre sí y qué reglas se usan exactamente para contar.", gl: "Ordenar a información: decidir como se conectan as táboas entre si e que regras se usan exactamente para contar." } },
  { icon: "🔎", tag: { es: "Sala 3", gl: "Sala 3" }, name: { es: "Calidad", gl: "Calidade" },
    what: { es: "Buscar errores y datos raros, averiguar por qué han aparecido y decidir qué hacer con ellos. Un dato malo da una cifra mala.", gl: "Buscar erros e datos raros, pescudar por que apareceron e decidir que facer con eles. Un dato malo dá unha cifra mala." } },
  { icon: "📊", tag: { es: "Sala 4", gl: "Sala 4" }, name: { es: "Visualización", gl: "Visualización" },
    what: { es: "Convertir las cifras en gráficos claros y honestos, que se entiendan de un vistazo y no engañen a nadie.", gl: "Converter as cifras en gráficos claros e honestos, que se entendan dunha ollada e non enganen a ninguén." } },
  { icon: "🤖", tag: { es: "Sala 5 (bonus)", gl: "Sala 5 (bonus)" }, name: { es: "Predicción", gl: "Predición" },
    what: { es: "Entrenar un modelo (un programa que aprende de casos pasados) para avisar, antes del alta, de qué pacientes pueden volver.", gl: "Adestrar un modelo (un programa que aprende de casos pasados) para avisar, antes da alta, de que pacientes poden volver." } },
  { icon: "🏛️", tag: { es: "Final", gl: "Final" }, name: { es: "Presentación", gl: "Presentación" },
    what: { es: "Contar a la Comisión de Calidad lo que habéis descubierto, proponer qué hacer y contestar a sus preguntas.", gl: "Contar á Comisión de Calidade o que descubristes, propoñer que facer e responder ás súas preguntas." } },
];
const SCREENS: Screen[] = [
  {
    icon: "🏥",
    title: { es: "Hospital Costa Atlántica · 10:00", gl: "Hospital Costa Atlántica · 10:00" },
    body: [
      { es: "Cuando un paciente mejora, el hospital le da el alta y se va a casa. Pero a veces, pocos días después, tiene que volver a quedarse ingresado. Eso se llama reingreso.", gl: "Cando un paciente mellora, o hospital dálle a alta e marcha para a casa. Pero ás veces, poucos días despois, ten que volver quedar ingresado. Iso chámase reingreso." },
      { es: "Un reingreso es mala señal: puede que el paciente se fuese demasiado pronto, que no entendiese cómo tomar la medicación o que nadie hiciese el seguimiento en casa. Además, ocupa camas que otras personas necesitan.", gl: "Un reingreso é mal sinal: pode que o paciente marchase demasiado cedo, que non entendese como tomar a medicación ou que ninguén fixese o seguimento na casa. Ademais, ocupa camas que outras persoas necesitan." },
      { es: "En el hospital creen que cada vez vuelven más pacientes. A las 13:00 se reúne la Comisión de Calidad, el grupo que vigila que se atienda bien, y quiere respuestas: ¿de verdad han subido los reingresos? ¿Cuánto? ¿Dónde? ¿Qué podemos hacer?", gl: "No hospital cren que cada vez volven máis pacientes. Ás 13:00 reúnese a Comisión de Calidade, o grupo que vixía que se atenda ben, e quere respostas: de verdade subiron os reingresos? Canto? Onde? Que podemos facer?" },
      { es: "El problema: los datos llegan de varios centros, cada uno a su manera, con ficheros repetidos y registros raros, y ahora mismo nadie se fía de los números. Si se decide con datos malos, se decide mal.", gl: "O problema: os datos chegan de varios centros, cada un á súa maneira, con ficheiros repetidos e rexistros raros, e agora mesmo ninguén se fía dos números. Se se decide con datos malos, decídese mal." },
      { es: "Todo es inventado: las personas, los centros y los datos no existen.", gl: "Todo é inventado: as persoas, os centros e os datos non existen." },
    ],
  },
  {
    icon: "🕵️",
    title: { es: "Sois el equipo de datos", gl: "Sodes o equipo de datos" },
    body: [
      { es: "Un equipo de datos es un grupo de personas que convierte información desordenada en respuestas de las que fiarse. No curan pacientes, pero ayudan a quienes deciden: recogen los datos, los ordenan, comprueban que están bien, los analizan y explican lo que significan.", gl: "Un equipo de datos é un grupo de persoas que converte información desordenada en respostas das que fiarse. Non curan pacientes, pero axudan a quen decide: recollen os datos, ordénanos, comproban que están ben, analízanos e explican o que significan." },
      { es: "Hoy ese equipo sois vosotros. Cada sala es una etapa del trabajo, en el mismo orden en que se hace de verdad:", gl: "Hoxe ese equipo sodes vós. Cada sala é unha etapa do traballo, na mesma orde na que se fai de verdade:" },
    ],
    extra: "rooms",
  },
  {
    icon: "🔐",
    title: { es: "Cómo se avanza", gl: "Como se avanza" },
    body: [
      { es: "Cada sala tiene varios niveles, que funcionan como candados: al resolver uno se abre el siguiente. Antes de empezar cada sala veréis un resumen de lo que vais a hacer en ella.", gl: "Cada sala ten varios niveis, que funcionan como cadeados: ao resolver un ábrese o seguinte. Antes de comezar cada sala veredes un resumo do que ides facer nela." },
      { es: "Cada nivel es una misión con datos: cargar ficheros, elegir opciones, montar gráficos, entrevistar a alguien o escribir una respuesta. Lo que necesitáis está en la pantalla del nivel y en sus documentos, así que leed con calma antes de probar.", gl: "Cada nivel é unha misión con datos: cargar ficheiros, elixir opcións, montar gráficos, entrevistar a alguén ou escribir unha resposta. O que precisades está na pantalla do nivel e nos seus documentos, así que lede con calma antes de probar." },
      { es: "Equivocarse no pasa nada: podéis probar las veces que haga falta.", gl: "Equivocarse non pasa nada: podedes probar as veces que faga falta." },
      { es: "Si os atascáis, preguntad a Lumi, la IA de la derecha: da pistas poco a poco y, si hace falta, la solución. Usarla cuesta: cada pregunta baja 1 la ⭐ Confianza de la Comisión, cada pista 5 y la solución 10. Es el único medidor del juego, que indica cuánto se fía la Comisión de vuestro trabajo.", gl: "Se vos atascades, preguntade a Lumi, a IA da dereita: dá pistas pouco a pouco e, se fai falta, a solución. Usala custa: cada pregunta baixa 1 a ⭐ Confianza da Comisión, cada pista 5 e a solución 10. É o único medidor do xogo, que indica canto se fía a Comisión do voso traballo." },
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
      {/* The navigation sits above the text so the buttons never move, however long the screen is. */}
      <div className="intronav">
        <button className="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>{es ? "Atrás" : "Atrás"}</button>
        <div>
          <div className="steps" aria-hidden="true">{SCREENS.map((_, j) => <span key={j} className={`dot ${j === i ? "on" : ""}`} />)}</div>
          <span aria-live="polite">{i + 1} / {SCREENS.length}</span>
        </div>
        <button className="primary" autoFocus onClick={() => (last ? onDone() : setI(i + 1))}>{last ? (es ? "Ver la pantalla ▶" : "Ver a pantalla ▶") : (es ? "Siguiente" : "Seguinte")}</button>
      </div>
      <div className="icon" aria-hidden="true">{s.icon}</div>
      <h2>{s.title[lang]}</h2>
      {s.body.map((p, j) => <p key={j}>{p[lang]}</p>)}
      {s.extra === "rooms" && (
        <ol className="phases">
          {ROOMS.map((r) => (
            <li key={r.name.es}>
              <span className="pico" aria-hidden="true">{r.icon}</span>
              <div><b>{r.tag[lang]} · {r.name[lang]}</b><span>{r.what[lang]}</span></div>
            </li>
          ))}
        </ol>
      )}
      {s.extra === "rules" && <ol className="rules">{RULES.map((r, j) => <li key={j}>{r[lang]}</li>)}</ol>}
    </section>
  );
}
