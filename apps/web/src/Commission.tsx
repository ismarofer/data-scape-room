import { useCallback, useEffect, useState } from "react";
import type { Lang } from "@codigo-alta/shared";
import { api, ApiError } from "./api";

export interface CommissionView {
  total: number; turn: number; done: boolean;
  question?: { persona: { id: string; name: string; role: string }; text: string };
  evidence: { id: string; title: string; text: string }[];
  history: { persona: string; question: string; answer: string; evidence: string[]; hint?: string }[];
  result?: { ending: "approved" | "conditions" | "more_data"; title: string; text: string; votes: { persona: string; vote: number }[]; report: string; badges: { id: string; name: string; why: string }[]; score: number };
}
const AVATAR: Record<string, string> = { valcarcel: "👩‍⚕️", pardo: "💼", louzao: "🩺" };
const ENDING_ICON = { approved: "🏆", conditions: "✅", more_data: "🔎" } as const;

/** The final: six questions from three Commission members, then the vote, the ending, the report and the badges. */
export function CommissionPanel({ teamId, lang }: { teamId: string; lang: Lang }) {
  const gl = lang === "gl";
  const [v, setV] = useState<CommissionView | null>(null);
  const [text, setText] = useState("");
  const [ev, setEv] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => api.commission(teamId, lang).then((x) => setV(x as CommissionView)).catch((e) => setErr((e as ApiError).message)), [teamId, lang]);
  useEffect(() => { load(); }, [load]);
  if (err && !v) return <p className="err viewpad">{err}</p>;
  if (!v) return <p className="viewpad">…</p>;

  const send = async () => {
    setBusy(true); setErr("");
    try { setV((await api.commissionAnswer(teamId, text, ev, lang)) as CommissionView); setText(""); setEv([]); }
    catch (e) { setErr((e as ApiError).message); }
    finally { setBusy(false); }
  };
  const last = v.history[v.history.length - 1];

  if (v.done && v.result) {
    const r = v.result;
    return (
      <section className="final" aria-label={gl ? "Resultado da Comisión" : "Resultado de la Comisión"}>
        <div className={`ending e-${r.ending}`}>
          <div className="eicon" aria-hidden="true">{ENDING_ICON[r.ending]}</div>
          <h2>{r.title}</h2>
          <p>{r.text}</p>
        </div>
        <h3>{gl ? "Os votos da Comisión" : "Los votos de la Comisión"}</h3>
        <ul className="votes">{r.votes.map((x) => <li key={x.persona}><span>{x.vote > 0 ? "👍" : x.vote < 0 ? "👎" : "🤔"}</span><b>{x.persona}</b> · {x.vote > 0 ? (gl ? "a favor" : "a favor") : x.vote < 0 ? (gl ? "pide máis datos" : "pide más datos") : (gl ? "con dúbidas" : "con dudas")}</li>)}</ul>
        <h3>{gl ? "O voso informe" : "Vuestro informe"}</h3>
        <p className="report">{r.report}</p>
        {r.badges.length > 0 && (<><h3>{gl ? "Insignias" : "Insignias"}</h3><ul className="badges">{r.badges.map((b) => <li key={b.id}><b>🎖 {b.name}</b><small>{b.why}</small></li>)}</ul></>)}
        <p className="hint-small">{gl ? `Puntuación final: ${r.score}. Esta puntuación serve para pechar o xogo, non para competir.` : `Puntuación final: ${r.score}. Esta puntuación sirve para cerrar el juego, no para competir.`} {gl ? "Grazas por xogar!" : "¡Gracias por jugar!"}</p>
      </section>
    );
  }

  return (
    <section className="commission" aria-label={gl ? "A Comisión" : "La Comisión"}>
      <p className="hint-small">{gl ? `Pregunta ${Math.min(v.turn + 1, v.total)} de ${v.total}` : `Pregunta ${Math.min(v.turn + 1, v.total)} de ${v.total}`}</p>
      <progress value={v.turn} max={v.total} aria-label="Progreso" />
      {v.question && (
        <div className="cq">
          <div className="cpers"><span className="av" aria-hidden="true">{AVATAR[v.question.persona.id] ?? "🧑"}</span><div><b>{v.question.persona.name}</b><small>{v.question.persona.role}</small></div></div>
          <blockquote>{v.question.text}</blockquote>
          <label>{gl ? "A vosa resposta (máximo 400 letras)" : "Vuestra respuesta (máximo 400 letras)"}
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={400} rows={5} disabled={busy} />
          </label>
          <small className="hint-small">{text.length}/400</small>
          {v.evidence.length > 0 && (
            <fieldset className="mlvars">
              <legend>{gl ? "Tarxetas de evidencia (ata 3): dan forza á resposta" : "Tarjetas de evidencia (hasta 3): dan fuerza a la respuesta"}</legend>
              {v.evidence.map((c) => (
                <label key={c.id} className="mlvar"><input type="checkbox" checked={ev.includes(c.id)} disabled={!ev.includes(c.id) && ev.length >= 3 || busy} onChange={() => setEv((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))} /><span><b>{c.title}</b><small>{c.text}</small></span></label>
              ))}
            </fieldset>
          )}
          <button className="primary" disabled={busy || text.trim().length < 10} onClick={send}>{busy ? (gl ? "A Comisión delibera…" : "La Comisión delibera…") : (gl ? "Responder" : "Responder")}</button>
          {err && <p role="alert" className="err">{err}</p>}
        </div>
      )}
      {last?.hint && <p className="note-warn">💡 {last.hint}</p>}
      {v.history.length > 0 && (
        <details className="chist">
          <summary>{gl ? `Preguntas xa respondidas (${v.history.length})` : `Preguntas ya respondidas (${v.history.length})`}</summary>
          <ol>{v.history.map((h, i) => <li key={i}><b>{h.persona}:</b> {h.question}<br /><i>{h.answer}</i></li>)}</ol>
        </details>
      )}
    </section>
  );
}
