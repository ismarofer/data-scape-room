import type { Lang, RoomView, TeamState } from "@codigo-alta/shared";
import { Markdown } from "./Markdown";

/**
 * Room briefing: the «phase 0» of every room. Before its first level the team sees what the room is about,
 * the levels it has (as a map), what they will learn and how long it should take. It can be reopened from the level header.
 */
export function RoomBriefing({ room, s, lang, onGo, again }: { room: RoomView; s: TeamState; lang: Lang; onGo: () => void; again?: boolean }) {
  const gl = lang === "gl";
  const levels = s.locks.filter((l) => l.room === room.id);
  const label = room.number === "F" ? room.stage : `${gl ? "Sala" : "Sala"} ${room.number} · ${room.stage}`;
  return (
    <section className="briefing" aria-label={`${label}: ${room.title}`}>
      <div className="bicon" aria-hidden="true">{room.icon ?? "🚪"}</div>
      <p className="bstage">{label}</p>
      <h2>{room.title}</h2>
      <p className="bintro">{room.intro}</p>
      {room.primer && (
        <div className="bprimer">
          <h3>📚 {room.primer.title}</h3>
          <Markdown source={room.primer.body} />
        </div>
      )}
      {room.briefing.length > 0 && (
        <>
          <h3>{gl ? "Nesta sala ides:" : "En esta sala vais a:"}</h3>
          <ul className="bgoals">{room.briefing.map((b) => <li key={b}>{b}</li>)}</ul>
        </>
      )}
      <h3>{gl ? "Os niveis" : "Los niveles"} <small>(~{room.targetMinutes} min)</small></h3>
      <ol className="bmap">
        {levels.map((l) => <li key={l.id} className={l.status}><span aria-hidden="true">{l.status === "done" ? "✔" : l.status === "open" ? "▶" : "🔒"}</span> {l.title}</li>)}
      </ol>
      {room.learn && <p className="blearn">🎓 <b>{gl ? "Que aprenderedes:" : "Qué aprenderéis:"}</b> {room.learn}</p>}
      <button className="primary big" onClick={onGo} autoFocus>{again ? (gl ? "Volver ao nivel" : "Volver al nivel") : (gl ? "Imos! ▶" : "¡Vamos! ▶")}</button>
    </section>
  );
}
