import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { Lang } from "@codigo-alta/shared";

type L2 = { es: string; gl: string };
interface Step { target: string; title: L2; text: L2 }
/** Each step lights up one part of the screen (an element with data-tour="…") and greys out the rest. */
export const TOUR: Step[] = [
  { target: "levels", title: { es: "Niveles", gl: "Niveis" }, text: { es: "Aquí están las salas y sus niveles. ▶ es el que toca ahora, ✔ uno superado (podéis volver a verlo) y 🔒 uno al que aún no habéis llegado.", gl: "Aquí están as salas e os seus niveis. ▶ é o que toca agora, ✔ un superado (podedes volver velo) e 🔒 un ao que aínda non chegastes." } },
  { target: "project", title: { es: "Ficheros del proyecto", gl: "Ficheiros do proxecto" }, text: { es: "Los datos que envían los hospitales y los documentos (docs) que os harán falta. Pulsad uno para abrirlo en una pestaña: arriba siempre veréis un recuadro «¿Qué es esto?».", gl: "Os datos que envían os hospitais e os documentos (docs) que vos farán falta. Premede un para abrilo nunha lapela: arriba sempre veredes un recadro «Que é isto?»." } },
  { target: "db", title: { es: "Base de datos", gl: "Base de datos" }, text: { es: "Las tablas que vais creando al trabajar. Pulsad una para ver sus filas y qué significa cada columna.", gl: "As táboas que ides creando ao traballar. Premede unha para ver as súas filas e que significa cada columna." } },
  { target: "tabs", title: { es: "Pestañas", gl: "Lapelas" }, text: { es: "«▶ Nivel actual» es donde se juega. Lo que abráis a la izquierda se abre al lado, en otra pestaña.", gl: "«▶ Nivel actual» é onde se xoga. O que abrades á esquerda ábrese ao lado, noutra lapela." } },
  { target: "pane", title: { es: "El nivel", gl: "O nivel" }, text: { es: "Todos los niveles son iguales: 🎯 Misión (qué hay que conseguir), 👣 Pasos (cómo), la herramienta para trabajar y, al final, qué hay que entregar.", gl: "Todos os niveis son iguais: 🎯 Misión (que hai que conseguir), 👣 Pasos (como), a ferramenta para traballar e, ao final, que hai que entregar." } },
  { target: "lumi", title: { es: "Lumi, vuestra ayudante", gl: "Lumi, a vosa axudante" }, text: { es: "Una IA que sabe de qué va cada nivel y ve lo que estáis probando. Preguntadle lo que sea: qué hacer, qué significa una palabra o si vais bien.", gl: "Unha IA que sabe de que vai cada nivel e ve o que estades a probar. Preguntádelle o que sexa: que facer, que significa unha palabra ou se ides ben." } },
  { target: "help", title: { es: "Pistas", gl: "Pistas" }, text: { es: "Si os atascáis, «Dame una pista». Hay 3 pistas y, al final, la solución. Se abren poco a poco (con intentos o con tiempo) y cuestan puntos.", gl: "Se vos atascades, «Dame unha pista». Hai 3 pistas e, ao final, a solución. Ábrense pouco a pouco (con intentos ou con tempo) e custan puntos." } },
  { target: "status", title: { es: "Tiempo, puntos y medidores", gl: "Tempo, puntos e medidores" }, text: { es: "El reloj cuenta hasta las 13:00. Vuestras decisiones suben o bajan la confianza, el cumplimiento y la calidad: cada cambio sale en un aviso con el motivo.", gl: "O reloxo conta ata as 13:00. As vosas decisións soben ou baixan a confianza, o cumprimento e a calidade: cada cambio sae nun aviso co motivo." } },
  { target: "statushelp", title: { es: "Ayuda siempre a mano", gl: "Axuda sempre a man" }, text: { es: "❓ explica los medidores, 📖 el glosario aclara palabras técnicas y «Cómo se juega» repite esta guía.", gl: "❓ explica os medidores, 📖 o glosario aclara palabras técnicas e «Como se xoga» repite esta guía." } },
];

interface Box { top: number; left: number; width: number; height: number }
const PAD = 6;

export function Tour({ lang, onDone }: { lang: Lang; onDone: () => void }) {
  const gl = lang === "gl";
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = TOUR[i];
  const last = i === TOUR.length - 1;
  const measure = useCallback(() => {
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    if (!el) { setBox(null); return; }
    el.scrollIntoView?.({ block: "nearest" });
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD });
  }, [step.target]);
  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => { window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure); }, [measure]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); else if (e.key === "ArrowRight") setI((x) => Math.min(TOUR.length - 1, x + 1)); else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onDone]);

  // the card goes next to the lit area, where there is room
  const vw = window.innerWidth, vh = window.innerHeight, cw = Math.min(360, vw - 24);
  let pos: React.CSSProperties = { top: vh / 2 - 100, left: vw / 2 - cw / 2 };
  if (box) {
    if (box.left + box.width + cw + 16 < vw) pos = { top: Math.min(Math.max(12, box.top), vh - 240), left: box.left + box.width + 12 };
    else if (box.left - cw - 16 > 0) pos = { top: Math.min(Math.max(12, box.top), vh - 240), left: box.left - cw - 12 };
    else if (box.top + box.height + 220 < vh) pos = { top: box.top + box.height + 12, left: Math.min(Math.max(12, box.left), vw - cw - 12) };
    else pos = { top: Math.max(12, box.top - 232), left: Math.min(Math.max(12, box.left), vw - cw - 12) };
  }
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={gl ? "Guía da pantalla" : "Guía de la pantalla"}>
      {box ? <div className="tour-spot" style={box} /> : <div className="tour-dim" />}
      <div className="tour-card" style={{ ...pos, width: cw }}>
        <p className="tour-n">{i + 1} / {TOUR.length}</p>
        <h3>{step.title[lang]}</h3>
        <p>{step.text[lang]}</p>
        <div className="row">
          <button className="ghost" onClick={onDone}>{gl ? "Saltar" : "Saltar"}</button>
          <span className="grow" />
          <button className="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>{gl ? "Atrás" : "Atrás"}</button>
          <button className="primary" autoFocus onClick={() => (last ? onDone() : setI(i + 1))}>{last ? (gl ? "Comezamos!" : "¡Empezamos!") : (gl ? "Seguinte" : "Siguiente")}</button>
        </div>
      </div>
    </div>
  );
}
