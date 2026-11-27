import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { Lang, TeamState } from "@codigo-alta/shared";
import { api, ApiError } from "./api";
import { getWorkContext, onUi } from "./workContext";
import { noteAction } from "./Feedback";

interface Msg { who: "me" | "ai"; text: string; src?: string }
const post = async (url: string, body: unknown) => (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const NOTICE = { es: "Personaje con IA. Puede equivocarse. No escribas datos personales.", gl: "Personaxe con IA. Pode equivocarse. Non escribas datos persoais." };

function Thread({ msgs, name }: { msgs: Msg[]; name: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "nearest" }); }, [msgs.length]);
  return <div className="thread" aria-live="polite">{msgs.map((m, i) => <p key={i} className={m.who}>{m.who === "ai" && <b>{name}: </b>}{m.text}{m.who === "ai" && m.src === "live" && <small className="ai-tag" title="Respuesta generada por el modelo">IA</small>}</p>)}<div ref={end} /></div>;
}

/** Lumi: the only help in the game. It knows the level, what the team is building and (server side) the solution. Help steps cost points. */
export function LumiChat({ teamId, lang, s, serverNow }: { teamId: string; lang: Lang; s: TeamState; serverNow: number }) {
  const gl = lang === "gl";
  const [msgs, setMsgs] = useState<(Msg & { lockId?: string | null })[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const lock = s.locks.find((l) => l.status === "open");
  const help = lock?.help;
  const used = lock?.hintsUsed ?? 0;
  const cost = s.aiCost?.lumi ?? 0;
  // the help status comes with the state; turn its wait into a live countdown
  const [deadline, setDeadline] = useState(0);
  useEffect(() => { setDeadline(help?.next && !help.next.unlocked ? s.serverNow + help.next.waitSeconds * 1000 : 0); }, [s.serverNow, help?.next?.level, help?.next?.unlocked]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = Math.max(0, Math.ceil((deadline - serverNow) / 1000));
  const nextUnlocked = !!help?.next && (help.next.unlocked || (deadline > 0 && left === 0));

  const load = useCallback(() => api.lumiHistory(teamId).then((r) => setMsgs(r.messages.map((m) => ({ who: m.role === "user" ? "me" : "ai", text: m.text, lockId: m.lockId })))).catch(() => {}), [teamId]);
  useEffect(() => { load(); }, [load, lock?.id, used]);
  useEffect(() => onUi((e) => { if (e.type === "lumi:ask") { if (e.text) setText(e.text); setTimeout(() => input.current?.focus(), 30); } }), []);

  const ask = async (q: string) => {
    const t = q.trim(); if (!t || busy) return;
    setMsgs((m) => [...m, { who: "me", text: t, lockId: lock?.id }]); setText(""); setBusy(true); setErr("");
    if (cost) noteAction(gl ? "Pregunta a Lumi" : "Pregunta a Lumi");
    try { const r = await post("/api/ai/lumi", { teamId, message: t, lang, work: getWorkContext(lock?.id) }); setMsgs((m) => [...m, { who: "ai", text: r.text ?? "…", src: r.source, lockId: lock?.id }]); }
    catch { setMsgs((m) => [...m, { who: "ai", text: gl ? "Agora non podo responder. Volve probar nun momento." : "Ahora no puedo responder. Vuelve a probar en un momento.", lockId: lock?.id }]); }
    finally { setBusy(false); }
  };
  const getHelp = async () => {
    if (!help?.next) return;
    const lvl = help.next.level, sol = lvl >= 4;
    if (sol && !window.confirm(gl ? `Ver a solución baixa ${help.next.penalty} a confianza. Seguro?` : `Ver la solución baja ${help.next.penalty} la confianza. ¿Seguro?`)) return;
    setBusy(true); setErr("");
    noteAction(lvl >= 4 ? (gl ? "Solución de Lumi" : "Solución de Lumi") : `${gl ? "Pista" : "Pista"} ${lvl} ${gl ? "de" : "de"} Lumi`);
    try { const r = await api.lumiHelp(teamId, lvl, lang); setMsgs((m) => [...m, { who: "ai", text: r.text, lockId: lock?.id, src: "help" }]); }
    catch (x) { setErr((x as ApiError).message); }
    finally { setBusy(false); }
  };
  const title = (id?: string | null) => s.locks.find((l) => l.id === id)?.title ?? "";
  const CHIPS = gl
    ? ["Que hai que facer aquí?", "Imos ben?", "Non entendo unha palabra", "Para que serve esta pantalla?"]
    : ["¿Qué hay que hacer aquí?", "¿Vamos bien?", "No entiendo una palabra", "¿Para qué sirve esta pantalla?"];
  const nextLabel = !help?.next ? "" : help.next.level >= 4 ? (gl ? "🔑 Ver a solución" : "🔑 Ver la solución") : `💡 ${gl ? "Dame unha pista" : "Dame una pista"}`;
  const waitParts = !help?.next || nextUnlocked ? [] : [help.next.attemptsNeeded ? (gl ? `tras ${help.next.attemptsNeeded} intento(s) máis` : `tras ${help.next.attemptsNeeded} intento(s) más`) : "", left > 0 ? `en ${fmtWait(left)}` : ""].filter(Boolean);
  const waitText = waitParts.length ? (gl ? "Ábrese " : "Se abre ") + waitParts.join(gl ? " ou " : " o ") : "";

  return (
    <section className="chat assistant" aria-label={gl ? "Asistente de IA" : "Asistente de IA"} data-tour="lumi">
      <h2 className="sidehead">{gl ? "Asistente de IA" : "Asistente de IA"}</h2>
      <div className="assist-head">
        <div className="lumi-id"><span className="lumi-av" aria-hidden="true">✨</span><div><b>Lumi</b> <small className="ai-tag">IA</small><small className="hint-small">{gl ? "A túa axudante. Pode equivocarse. Non escribas datos persoais." : "Tu ayudante. Puede equivocarse. No escribas datos personales."}</small></div></div>
        {lock && help && (
          <div className="helpbox" data-tour="help">
            <div className="helprow">
              <span>{gl ? "Axudas neste nivel" : "Ayudas en este nivel"}</span>
              <span className="ladder" aria-label={`${used} / 4`}>{[1, 2, 3, 4].map((i) => <i key={i} className={i <= used ? "on" : ""} title={i === 4 ? (gl ? "Solución" : "Solución") : `${gl ? "Pista" : "Pista"} ${i}`}>{i === 4 ? "🔑" : i}</i>)}</span>
            </div>
            {help.next ? (
              <>
                <button className="helpbtn" disabled={!nextUnlocked || busy} onClick={getHelp}>{nextLabel} <small>(−{help.next.penalty} {gl ? "confianza" : "confianza"})</small></button>
                {!nextUnlocked && waitText && <small className="hint-small">⏳ {waitText}</small>}
              </>
            ) : <small className="hint-small">{gl ? "Xa tedes todas as axudas deste nivel." : "Ya tenéis todas las ayudas de este nivel."}</small>}
            {err && <small className="err">{err}</small>}
          </div>
        )}
      </div>
      {msgs.length === 0 && <p className="assist-empty">{gl ? "Ola! Son Lumi. Sei de que vai cada nivel e vexo o que estades a probar. Preguntádeme o que queirades (cada pregunta baixa un pouco a confianza): explícovolo, dígovos se ides ben e, se vos atascades, dóuvos pistas." : "¡Hola! Soy Lumi. Sé de qué va cada nivel y veo lo que estáis probando. Preguntadme lo que queráis (cada pregunta baja un poco la confianza): os lo explico, os digo si vais bien y, si os atascáis, os doy pistas."}</p>}
      <div className="thread" aria-live="polite">
        {msgs.map((m, i) => (
          <Fragment key={i}>
            {m.lockId && m.lockId !== msgs[i - 1]?.lockId && <div className="tdiv"><span>{title(m.lockId)}</span></div>}
            <p className={`${m.who}${m.src === "help" || /^(💡|🔑)/.test(m.text) ? " helpmsg" : ""}`}>{m.who === "ai" && <b>Lumi: </b>}{m.text}</p>
          </Fragment>
        ))}
        {busy && <p className="ai typing" aria-label={gl ? "Lumi está a escribir" : "Lumi está escribiendo"}><span /><span /><span /></p>}
        <EndRef dep={msgs.length + (busy ? 1 : 0)} />
      </div>
      <div className="chips" role="group" aria-label={gl ? "Preguntas rápidas" : "Preguntas rápidas"}>{CHIPS.map((c) => <button key={c} className="chip-q" disabled={busy || !lock} onClick={() => ask(c)}>{c}</button>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="assist-form">
        <textarea ref={input} rows={2} aria-label={gl ? "Pregúntalle a Lumi" : "Pregúntale a Lumi"} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(text); } }} maxLength={500} placeholder={gl ? "Pregúntalle a Lumi…" : "Pregúntale a Lumi…"} />
        <button disabled={busy || !text.trim()} aria-label={gl ? "Enviar" : "Enviar"}>➤</button>
      </form>
      {cost > 0 && <small className="hint-small aicost">{gl ? `Cada pregunta a Lumi baixa ${cost} a confianza; cada pista, máis. Pensade antes de preguntar.` : `Cada pregunta a Lumi baja ${cost} la confianza; cada pista, más. Pensad antes de preguntar.`}</small>}
    </section>
  );
}
const fmtWait = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} min` : `${sec} s`);
function EndRef({ dep }: { dep: number }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "nearest" }); }, [dep]);
  return <div ref={end} />;
}

const NPCS = [{ id: "noa", name: "Noa", role: { es: "Informática", gl: "Informática" } }, { id: "brais", name: "Brais", role: { es: "Admisiones", gl: "Admisións" } }];
export function NpcChat({ teamId, lang, onClue, clues: known = [] }: { teamId: string; lang: Lang; onClue: () => void; clues?: string[] }) {
  const [npc, setNpc] = useState(NPCS[0].id);
  const [threads, setThreads] = useState<Record<string, Msg[]>>({});
  const [left, setLeft] = useState<Record<string, number>>({ noa: 6, brais: 6 });
  const [found, setClues] = useState<string[]>([]);
  const clues = [...new Set([...known, ...found])];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    NPCS.forEach(async (n) => { const g = await (await fetch(`/api/ai/greeting/${n.id}?lang=${lang}`)).json(); setThreads((t) => (t[n.id] ? t : { ...t, [n.id]: [{ who: "ai", text: g.text }] })); });
  }, [lang]);
  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim(); if (!t || left[npc] <= 0) return;
    setThreads((s) => ({ ...s, [npc]: [...(s[npc] ?? []), { who: "me", text: t }] })); setText(""); setBusy(true);
    try {
      const r = await post(`/api/ai/npc/${npc}`, { teamId, message: t, lang });
      setThreads((s) => ({ ...s, [npc]: [...(s[npc] ?? []), { who: "ai", text: r.text }] }));
      setLeft((l) => ({ ...l, [npc]: r.left }));
      if (r.revealed?.length) { setClues((c) => [...new Set([...c, ...r.revealed])]); onClue(); }
    } finally { setBusy(false); }
  };
  const cur = NPCS.find((n) => n.id === npc)!;
  return (
    <section className="chat npc" aria-label="Entrevistas">
      <div role="tablist" className="tabs">{NPCS.map((n) => <button key={n.id} role="tab" aria-selected={npc === n.id} className={`tab ${npc === n.id ? "on" : ""}`} onClick={() => setNpc(n.id)}>{n.name} · {n.role[lang]} ({left[n.id]})</button>)}</div>
      <p className="hint-small"><span className="ai-tag">{lang === "gl" ? "Personaxe con IA" : "Personaje con IA"}</span> {NOTICE[lang]}</p>
      <Thread msgs={threads[npc] ?? []} name={cur.name} />
      <form onSubmit={ask} className="row"><input aria-label={`${lang === "gl" ? "Pregúntalle a" : "Pregúntale a"} ${cur.name}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} style={{ flex: 1 }} disabled={left[npc] <= 0} /><button disabled={busy || left[npc] <= 0 || !text.trim()}>➤</button></form>
      <p aria-live="polite">🔎 {lang === "gl" ? "Pistas atopadas" : "Pistas encontradas"}: <b>{clues.length}/3</b></p>
    </section>
  );
}
