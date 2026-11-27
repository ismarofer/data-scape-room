import { useCallback, useEffect, useState } from "react";
import type { Lang } from "@codigo-alta/shared";
import { api, ApiError } from "./api";

export interface CommissionView {
  total: number; turn: number; done: boolean;
  question?: { persona: { id: string; name: string; role: string }; text: string; tip?: string };
  evidence: { id: string; icon?: string; title: string; text: string }[];
  history: { persona: string; question: string; answer: string; evidence: string[]; hint?: string }[];
  result?: { ending: "approved" | "conditions" | "more_data"; title: string; text: string; votes: { persona: string; vote: number }[]; report: string; badges: { id: string; name: string; why: string }[]; score: number };
}
const AVATAR: Record<string, string> = { valcarcel: "👩‍⚕️", pardo: "💼", louzao: "🩺" };
const ENDING_ICON = { approved: "🏆", conditions: "✅", more_data: "🔎" } as const;

/**
 * The final: five functional questions from three non-technical Commission members, then the vote, the ending, the
 * report and the badges. Under the question, a short summary of everything the team did, as cards, to answer from.
 */
export function CommissionPanel({ teamId, lang }: { teamId: string; lang: Lang }) {
  const gl = lang === "gl";
  const [v, setV] = useState<CommissionView | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => api.commission(teamId, lang).then((x) => setV(x as CommissionView)).catch((e) => setErr((e as ApiError).message)), [teamId, lang]);
  useEffect(() => { load(); }, [load]);
  if (err && !v) return <p className="err viewpad">{err}</p>;
  if (!v) return <p className="viewpad">…</p>;

  const send = async () => {
    setBusy(true); setErr("");
    try { setV((await api.commissionAnswer(teamId, text, [], lang)) as CommissionView); setText(""); }
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
        {v.history.length > 0 && (
          <details className="chist" open>
            <summary>{gl ? `As preguntas e as vosas respostas (${v.history.length})` : `Las preguntas y vuestras respuestas (${v.history.length})`}</summary>
            <ol>{v.history.map((h, i) => <li key={i}><b>{h.persona}:</b> {h.question}<br /><i>{h.answer}</i>{h.hint && <small className="hint-small"> · 💡 {h.hint}</small>}</li>)}</ol>
          </details>
        )}
        {r.badges.length > 0 && (<><h3>{gl ? "Insignias" : "Insignias"}</h3><ul className="badges">{r.badges.map((b) => <li key={b.id}><b>🎖 {b.name}</b><small>{b.why}</small></li>)}</ul></>)}
        <p className="hint-small">{gl ? `Confianza final da Comisión: ${r.score}/100. Serve para pechar o xogo, non para competir.` : `Confianza final de la Comisión: ${r.score}/100. Sirve para cerrar el juego, no para competir.`} {gl ? "Grazas por xogar!" : "¡Gracias por jugar!"}</p>
      </section>
    );
  }

  return (
    <section className="commission" aria-label={gl ? "A Comisión" : "La Comisión"}>
      <div className="cintro">
        <b>{gl ? "Que buscan?" : "¿Qué buscan?"}</b> {gl
          ? "Non saben de datos: queren entender que lles pasa aos seus pacientes e que facer. Respondede curto e sen palabras técnicas, como llo contariades á vosa familia: unha cifra, se vos fiades dela e que proporiades. Todo o que precisades está no resumo de abaixo."
          : "No saben de datos: quieren entender qué les pasa a sus pacientes y qué hacer. Responded corto y sin palabras técnicas, como se lo contaríais a vuestra familia: una cifra, si os fiáis de ella y qué propondríais. Todo lo que necesitáis está en el resumen de abajo."}
      </div>
      <p className="hint-small">{gl ? `Pregunta ${Math.min(v.turn + 1, v.total)} de ${v.total}` : `Pregunta ${Math.min(v.turn + 1, v.total)} de ${v.total}`}</p>
      <progress value={v.turn} max={v.total} aria-label="Progreso" />
      {v.question && (
        <div className="cq">
          <div className="cpers"><span className="av" aria-hidden="true">{AVATAR[v.question.persona.id] ?? "🧑"}</span><div><b>{v.question.persona.name}</b><small>{v.question.persona.role}</small></div></div>
          <blockquote>{v.question.text}</blockquote>
          {v.question.tip && <p className="ctip">💡 <b>{gl ? "Unha boa resposta:" : "Una buena respuesta:"}</b> {v.question.tip}</p>}
          <label>{gl ? "A vosa resposta (máximo 400 letras)" : "Vuestra respuesta (máximo 400 letras)"}
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={400} rows={5} disabled={busy} />
          </label>
          <small className="hint-small">{text.length}/400</small>
          <button className="primary" disabled={busy || text.trim().length < 10} onClick={send}>{busy ? (gl ? "A Comisión delibera…" : "La Comisión delibera…") : (gl ? "Responder" : "Responder")}</button>
          {err && <p role="alert" className="err">{err}</p>}
        </div>
      )}
      {last?.hint && <p className="note-warn">💡 {last.hint}</p>}
      {v.evidence.length > 0 && (
        <section className="csummary" aria-label={gl ? "Resumo do voso traballo" : "Resumen de vuestro trabajo"}>
          <h3>📋 {gl ? "O que fixestes e decidistes (para responder)" : "Lo que habéis hecho y decidido (para responder)"}</h3>
          <div className="ccards">{v.evidence.map((c) => <article key={c.id} className="ccard"><h4>{c.icon} {c.title}</h4><p>{c.text}</p></article>)}</div>
        </section>
      )}
      {v.history.length > 0 && (
        <details className="chist">
          <summary>{gl ? `Preguntas xa respondidas (${v.history.length})` : `Preguntas ya respondidas (${v.history.length})`}</summary>
          <ol>{v.history.map((h, i) => <li key={i}><b>{h.persona}:</b> {h.question}<br /><i>{h.answer}</i></li>)}</ol>
        </details>
      )}
    </section>
  );
}
