import { useCallback, useEffect, useState } from "react";

interface TeamRow { teamId: string; alias: string; score: number; meters: { trust: number; compliance: number; quality: number; ai_credits: number }; currentLock: string | null; hintsUsed: number; minutesInLock: number; done: number; total: number }
interface Detail { teamId: string; alias: string; score: number; progress: Record<string, { status: string; attempts: number; hints: number; points: number; master: boolean }>; ledger: { lock_id: string; choice: string; tag?: string }[]; events: { type: string; payload: string; ts: number }[]; ai: { character: string; lock_id: string | null; role: string; text: string; ts: number }[] }

const save = (name: string, mime: string, data: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
};
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Facilitator console (route /facilitador). Everything needs the PIN; it never shows answers. */
export function Facilitator() {
  const [pin, setPin] = useState(() => { try { return sessionStorage.getItem("ca_pin") ?? ""; } catch { return ""; } });
  const [input, setInput] = useState("");
  const [data, setData] = useState<{ paused: boolean; teams: TeamRow[] } | null>(null);
  const [err, setErr] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [now, setNow] = useState(Date.now());
  const [levels, setLevels] = useState<{ id: string; title: string; room: string }[]>([]);
  const [jump, setJump] = useState<Record<string, string>>({});
  const [testAlias, setTestAlias] = useState("Prueba");
  const [testLock, setTestLock] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const H = useCallback(() => ({ "x-facilitator-pin": pin, "content-type": "application/json" }), [pin]);

  const refresh = useCallback(async () => {
    if (!pin) return;
    try {
      const r = await fetch("/api/facilitator/overview", { headers: H() });
      if (r.status === 401) { setErr("PIN incorrecto"); setPin(""); try { sessionStorage.removeItem("ca_pin"); } catch { /* ignore */ } return; }
      setData(await r.json()); setErr(""); setNow(Date.now());
    } catch { setErr("Sin conexión con el servidor"); }
  }, [pin, H]);
  useEffect(() => { refresh(); const i = setInterval(refresh, 5000); return () => clearInterval(i); }, [refresh]);
  useEffect(() => { if (pin) fetch("/api/facilitator/levels", { headers: H() }).then((r) => (r.ok ? r.json() : { levels: [] })).then((d) => { setLevels(d.levels ?? []); setTestLock((x) => x || d.levels?.[0]?.id || ""); }).catch(() => {}); }, [pin, H]);
  const levelOptions = levels.map((l) => <option key={l.id} value={l.id}>{l.room} — {l.title}</option>);
  const goTo = async (teamId: string, alias: string, lockId: string) => {
    if (!lockId) return;
    if (!window.confirm(`¿Llevar a «${alias}» al inicio de «${levels.find((l) => l.id === lockId)?.title ?? lockId}»? Los niveles anteriores quedan resueltos y ese nivel y los siguientes empiezan de cero.`)) return;
    await post("/api/facilitator/jump", { teamId, lockId });
  };
  const createTest = async (e: React.FormEvent) => {
    e.preventDefault(); setTestMsg("");
    const r = await fetch("/api/facilitator/test-team", { method: "POST", headers: H(), body: JSON.stringify({ alias: testAlias.trim(), lockId: testLock }) });
    const d = await r.json().catch(() => ({}));
    setTestMsg(r.ok ? `✔ Listo: abrid ${location.origin}/ y entrad con el nombre «${d.alias}». Estará en «${levels.find((l) => l.id === testLock)?.title}».` : `✘ ${d.message ?? "No se pudo crear"}`);
    refresh();
  };

  const login = (e: React.FormEvent) => { e.preventDefault(); try { sessionStorage.setItem("ca_pin", input); } catch { /* ignore */ } setPin(input); };
  const post = async (url: string, body: unknown) => { await fetch(url, { method: "POST", headers: H(), body: JSON.stringify(body) }); refresh(); };
  const open = async (id: string) => setDetail(await (await fetch(`/api/facilitator/team/${id}`, { headers: H() })).json());
  const exportJson = async () => save(`dataquest-${new Date().toISOString().slice(0, 16)}.json`, "application/json", JSON.stringify(await (await fetch("/api/facilitator/export", { headers: H() })).json(), null, 1));
  const exportCsv = () => {
    if (!data) return;
    const head = ["equipo", "confianza", "candado_actual", "hechos", "total", "min_en_candado", "pistas"];
    save("dataquest-equipos.csv", "text/csv", [head, ...data.teams.map((t) => [t.alias, t.meters.trust, t.currentLock, t.done, t.total, t.minutesInLock, t.hintsUsed])].map((r) => r.map(csvCell).join(",")).join("\n"));
  };

  if (!pin) return (
    <main className="fac"><form className="card join" onSubmit={login}>
      <h1>Consola del facilitador</h1>
      <label>PIN<input type="password" value={input} onChange={(e) => setInput(e.target.value)} autoFocus required /></label>
      <button type="submit">Entrar</button><p role="alert" className="err">{err}</p>
    </form></main>
  );

  const url = `${location.origin}/`;
  return (
    <main className="fac">
      <header className="fachead">
        <h1>Consola del facilitador</h1>
        <div className="facbar">
          <button className={data?.paused ? "primary" : "ghost"} onClick={() => post("/api/facilitator/pause", { paused: !data?.paused })}>{data?.paused ? "▶ Reanudar la partida" : "⏸ Pausar la partida"}</button>
          <button className="ghost" onClick={exportCsv}>⬇ CSV de equipos</button>
          <button className="ghost" onClick={exportJson}>⬇ JSON completo</button>
          <button className="ghost" onClick={() => { try { sessionStorage.removeItem("ca_pin"); } catch { /* ignore */ } setPin(""); setData(null); }}>Salir</button>
        </div>
      </header>
      <section className="card facjoin"><b>Dirección para los equipos:</b> <span className="bigurl">{url}</span> <small>(abridla en cada portátil y escribid el nombre del equipo)</small></section>
      <section className="card factest" aria-label="Probar un nivel">
        <h2>🧪 Probar un nivel concreto</h2>
        <p className="hint-small">Crea (o reutiliza) un equipo y lo deja al inicio del nivel elegido: los niveles anteriores cuentan como resueltos bien (ficheros cargados, decisiones correctas, mínimo de 30 altas) y ese nivel empieza de cero. No toca la confianza.</p>
        <form className="row" onSubmit={createTest}>
          <label>Nombre del equipo<input value={testAlias} onChange={(e) => setTestAlias(e.target.value)} minLength={2} maxLength={24} required /></label>
          <label>Nivel<select value={testLock} onChange={(e) => setTestLock(e.target.value)}>{levelOptions}</select></label>
          <button type="submit" className="primary">Ir a ese nivel ▶</button>
        </form>
        {testMsg && <p role="status">{testMsg}</p>}
        <p className="hint-small">Si ya tenéis el juego abierto con ese equipo, se actualiza solo. Para volver a probar el mismo nivel, pulsad otra vez el botón.</p>
      </section>
      {data?.paused && <p className="note-warn" role="status">⏸ La partida está en pausa: los equipos no pueden entregar.</p>}
      {err && <p role="alert" className="err">{err}</p>}
      <div className="scroll big">
        <table className="prev factable">
          <thead><tr><th>Equipo</th><th>Candado</th><th>Progreso</th><th>Min.</th><th>Pistas</th><th>Confianza</th><th>Acciones</th></tr></thead>
          <tbody>
            {(data?.teams ?? []).map((t) => (
              <tr key={t.teamId} className={t.minutesInLock >= 15 ? "stuck" : ""}>
                <td><b>{t.alias}</b></td><td><code>{t.currentLock ?? "fin"}</code></td>
                <td><progress value={t.done} max={t.total} /> {t.done}/{t.total}</td>
                <td>{t.minutesInLock}{t.minutesInLock >= 15 ? " ⚠" : ""}</td><td>{t.hintsUsed}</td>
                <td className={t.meters.trust < 35 ? "bad" : ""}>{t.meters.trust}</td>
                <td><button className="ghost" onClick={() => open(t.teamId)}>Detalle</button>{" "}
                  <select aria-label={`Nivel al que llevar a ${t.alias}`} value={jump[t.teamId] ?? ""} onChange={(e) => setJump({ ...jump, [t.teamId]: e.target.value })}><option value="">Ir a nivel…</option>{levelOptions}</select>
                  <button className="ghost" disabled={!jump[t.teamId]} onClick={() => goTo(t.teamId, t.alias, jump[t.teamId])}>▶ Ir</button>{" "}<button className="ghost" onClick={() => { if (window.confirm(`¿Saltar el candado «${t.currentLock}» de ${t.alias}? (baja 10 la confianza)`)) post("/api/locks/master-key", { teamId: t.teamId }); }} disabled={!t.currentLock}>🗝 Llave maestra</button></td>
              </tr>
            ))}
            {data && !data.teams?.length && <tr><td colSpan={10}>Aún no hay equipos.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="hint-small">Se actualiza solo cada 5 s{data ? ` (última: ${new Date(now).toLocaleTimeString()})` : ""}. Una fila resaltada = el equipo lleva 15 min o más en el mismo candado.</p>

      {detail && (
        <section className="card facdetail" aria-label={`Detalle de ${detail.alias}`}>
          <h2>{detail.alias} <button className="ghost" onClick={() => setDetail(null)}>✕ Cerrar</button></h2>
          <h3>Candados</h3>
          <ul className="fprog">{Object.entries(detail.progress).map(([id, p]) => <li key={id} className={p.status}><code>{id}</code> · {p.status} · intentos {p.attempts} · pistas {p.hints}{p.master ? " · 🗝" : ""} · {p.points} pts</li>)}</ul>
          <h3>Decisiones</h3>
          <ul>{detail.ledger.map((l, i) => <li key={i}><code>{l.lock_id}</code>: {l.tag ?? l.choice}</li>)}{!detail.ledger.length && <li>—</li>}</ul>
          <h3>Conversaciones con la IA</h3>
          <div className="aithread">{detail.ai.map((m, i) => <p key={i} className={m.role === "user" ? "me" : "ai"}><b>{m.character}{m.lock_id ? ` · ${m.lock_id}` : ""}:</b> {m.text}</p>)}{!detail.ai.length && <p>—</p>}</div>
          <h3>Últimos eventos</h3>
          <ul className="fev">{detail.events.slice(0, 25).map((e, i) => <li key={i}><small>{new Date(e.ts).toLocaleTimeString()}</small> {e.type} <code>{e.payload.slice(0, 90)}</code></li>)}</ul>
        </section>
      )}
    </main>
  );
}
