import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LANGS, type Lang, type Project, type TeamState } from "@codigo-alta/shared";
import { api, ApiError, connectWs } from "./api";
import { Intro } from "./Intro";
import { GlossaryPanel, MetersLegend } from "./Explain";
import { LumiChat } from "./Chat";
import { ThemeToggle } from "./ThemeToggle";
import { DbTableView, DbTree, useDbCatalog } from "./DbInspector";
import { CommissionPanel } from "./Commission";
import { fmt, LevelDesk } from "./LevelDesk";
import { FileViewer, kindOf, RAW_FILES } from "./FileViewer";
import { Tour } from "./Tour";
import { RoomBriefing } from "./Briefing";
import { MeterChip, Toasts, useMeterFeedback } from "./Feedback";
import { setView } from "./workContext";

const store = {
  read: (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } },
  write: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const base = (p: string) => p.split("/").pop()!;
const FILE_ICON = { csv: "▦", sql: "◈", md: "✎" } as const;

/** Vertical drag handle between two panels (mouse, touch and arrow keys). */
function Sash({ label, onDrag, onStep }: { label: string; onDrag: (clientX: number) => void; onStep: (dx: number) => void }) {
  return (
    <div
      className="sash" role="separator" aria-orientation="vertical" aria-label={label} tabIndex={0}
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
      onPointerMove={(e) => { if (e.buttons & 1) onDrag(e.clientX); }}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") onStep(-16); else if (e.key === "ArrowRight") onStep(16); }}
    />
  );
}

/** Horizontal drag handle between two explorer sections (mouse, touch and arrow keys). */
function HSash({ label, onStart, onMove, onKey }: { label: string; onStart: () => void; onMove: (dy: number) => void; onKey: (dy: number) => void }) {
  const y0 = useRef(0);
  return (
    <div
      className="hsash" role="separator" aria-orientation="horizontal" aria-label={label} tabIndex={0}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); y0.current = e.clientY; onStart(); }}
      onPointerMove={(e) => { if (e.buttons & 1) onMove(e.clientY - y0.current); }}
      onKeyDown={(e) => { if (e.key === "ArrowUp") onKey(-16); else if (e.key === "ArrowDown") onKey(16); }}
    />
  );
}
const SECS = ["levels", "project", "dbsec"] as const;

type Dict = Record<string, any>;
interface Props { teamId: string; lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string; dict: Dict; onExit: () => void }

/** The whole game screen, laid out like VS Code: explorer on the left, editor tabs in the middle, AI assistant on the right, status bar below. */
export function Workbench({ teamId, lang, setLang, t, onExit }: Props) {
  const gl = lang === "gl";
  const [s, setS] = useState<TeamState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [skew, setSkew] = useState(0);
  const [introSeen, setIntroSeen] = useState(!!store.read(`ca_intro_${teamId}`));
  const [touring, setTouring] = useState(false);
  const [briefed, setBriefed] = useState<string[]>(() => { try { return JSON.parse(store.read(`ca_brief_${teamId}`) || "[]"); } catch { return []; } });
  const [briefAgain, setBriefAgain] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [sheet, setSheet] = useState<Record<string, any> | null>(null);
  const [tabs, setTabs] = useState<string[]>(["current"]);
  const [active, setActive] = useState("current");
  const [closed, setClosed] = useState<string[]>([]); // collapsed explorer sections / folders
  const db = useDbCatalog();
  const [wts, setWts] = useState<number[]>(() => { try { const v = JSON.parse(store.read("ca_secw") || "null"); if (Array.isArray(v) && v.length === 3 && v.every((x) => Number(x) > 0)) return v.map(Number); } catch { /* ignore */ } return [1.3, 1, 1]; });
  const secRefs = useRef<(HTMLDivElement | null)[]>([]);
  const baseH = useRef<number[]>([]);
  const [left, setLeft] = useState(() => clamp(Number(store.read("ca_w_left")) || 270, 170, 520));
  const [right, setRight] = useState(() => clamp(Number(store.read("ca_w_right")) || 340, 260, 640));

  useEffect(() => { api.models().then(setProject).catch(() => {}); fetch("/data/raw/manifest.json").then((r) => r.json()).then(setSheet).catch(() => {}); }, []);
  const refresh = useCallback(() => api.state(teamId, lang).then((st) => { setS(st); setSkew(st.serverNow - Date.now()); }).catch((e) => { if ((e as ApiError).code === "no_team") onExit(); }), [teamId, lang, onExit]);
  useEffect(() => { refresh(); return connectWs(teamId, (ty) => { if (ty !== "timer_tick") refresh(); }); }, [teamId, refresh]);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  // when the team reaches a new level, bring the game tab to the front
  const currentId = s?.currentLockId ?? null;
  useEffect(() => { setActive("current"); }, [currentId]);
  const fb = useMeterFeedback(s, lang);
  // Lumi is told what the player is looking at
  useEffect(() => { setView(active === "current" ? "el nivel actual" : active.startsWith("db:") ? `la tabla ${active.slice(3)} de la base de datos` : active.startsWith("lvl:") ? `el nivel ya superado ${active.slice(4)}` : `el fichero ${active.slice(5)}`); }, [active]);

  const open = useCallback((id: string) => { setTabs((x) => (x.includes(id) ? x : [...x, id])); setActive(id); }, []);
  const close = (id: string) => {
    const i = tabs.indexOf(id);
    setTabs(tabs.filter((x) => x !== id));
    if (active === id) setActive(tabs[i - 1] ?? "current");
  };
  const toggle = (k: string) => setClosed((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const heights = () => SECS.map((_, k) => secRefs.current[k]?.getBoundingClientRect().height ?? 120);
  const resizePair = (i: number, dy: number, base: number[]) => {
    let a = i; while (a >= 0 && closed.includes(SECS[a])) a--;
    let b = i + 1; while (b < SECS.length && closed.includes(SECS[b])) b++;
    if (a < 0 || b >= SECS.length) return;
    const tot = base[a] + base[b], na = clamp(base[a] + dy, 50, tot - 50);
    const w = SECS.map((k, j) => (closed.includes(k) ? wts[j] : base[j]));
    w[a] = na; w[b] = tot - na;
    setWts(w); store.write("ca_secw", JSON.stringify(w));
  };
  const resizeLeft = (w: number) => { const v = clamp(w, 170, 520); setLeft(v); store.write("ca_w_left", String(v)); };
  const resizeRight = (w: number) => { const v = clamp(w, 260, 640); setRight(v); store.write("ca_w_right", String(v)); };

  const files = useMemo(() => {
    if (!s) return [] as { dir: string; paths: string[] }[];
    const reached = (id: string) => s.locks.some((l) => l.id === id && l.status !== "locked");
    const models = (project?.models ?? []).filter((m) => reached("r3c_modelo")).map((m) => `models/${m.name}.sql`);
    return [
      { dir: "data/raw", paths: RAW_FILES.map((f) => `data/raw/${f}`) },
      ...(models.length ? [{ dir: "models", paths: models }] : []),
      ...(s.docs.length ? [{ dir: "docs", paths: s.docs.map((d) => d.path) }] : []),
    ];
  }, [s, project]);

  if (!s) return <p className="viewpad">…</p>;
  const lock = s.locks.find((l) => l.status === "open");
  const curRoom = lock ? s.rooms.find((r) => r.id === lock.room) : undefined;
  const needBrief = !!curRoom && introSeen && !touring && (!briefed.includes(curRoom.id) || briefAgain);
  const doneBrief = () => { if (!curRoom) return; const n = [...new Set([...briefed, curRoom.id])]; setBriefed(n); store.write(`ca_brief_${teamId}`, JSON.stringify(n)); setBriefAgain(false); };
  const serverNow = now + skew;
  const remaining = s.startedAt + 180 * 60_000 - serverNow;
  const levelTitle = (id: string) => s.locks.find((l) => l.id === id)?.title ?? id;
  const tabLabel = (id: string) => {
    if (id === "current") return `▶ ${lock ? lock.title : gl ? "Final" : "Final"}`;
    if (id.startsWith("lvl:")) return `✔ ${levelTitle(id.slice(4))}`;
    if (id.startsWith("db:")) return `▤ ${id.slice(3)}`;
    const p = id.slice(5);
    return `${FILE_ICON[kindOf(p)]} ${base(p)}`;
  };

  return (
    <div className="ide">
      <header className="titlebar">
        <strong>{t("app.title")}</strong>
        <small className="disclaimer">{t("app.disclaimer")}</small>
        <span className="alias">{s.alias}</span>
        <button className="ghost exitbtn" onClick={() => { if (window.confirm(gl ? "Saír deste equipo e entrar noutra sesión? O progreso queda gardado." : "¿Salir de este equipo y entrar en otra sesión? El progreso queda guardado.")) onExit(); }}>{gl ? "Cambiar de equipo" : "Cambiar de equipo"}</button>
      </header>

      <div className="body" style={{ "--left": `${left}px`, "--right": `${right}px` } as React.CSSProperties}>
        <aside className="side explorer" aria-label={gl ? "Explorador" : "Explorador"}>
          <h2 className="sidehead">{gl ? "Explorador" : "Explorador"}</h2>
          <div className="sections" style={{ gridTemplateRows: [0, 1, 2].flatMap((k) => [...(k ? ["5px"] : []), closed.includes(SECS[k]) ? "auto" : `minmax(0, ${wts[k]}fr)`]).join(" ") }}>
          <div className="section" data-tour="levels" ref={(el) => { secRefs.current[0] = el; }}>
            <button className="secthead" aria-expanded={!closed.includes("levels")} onClick={() => toggle("levels")}>{closed.includes("levels") ? "▸" : "▾"} {gl ? "NIVEIS" : "NIVELES"}</button>
            <div className="sectbody">
            {!closed.includes("levels") && (
              <ul className="tree" role="tree" aria-label={gl ? "Niveis" : "Niveles"}>
                {s.rooms.map((room) => {
                  const ls = s.locks.filter((l) => l.room === room.id);
                  if (!ls.length) return null;
                  const key = `room:${room.id}`, doneN = ls.filter((l) => l.status === "done").length, isOpen = !closed.includes(key);
                  return (
                    <li key={room.id} role="treeitem" aria-expanded={isOpen}>
                      <button className="node folder room" onClick={() => toggle(key)} title={`${room.title}: ${room.intro}`}>
                        <span className="ico" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                        <span className="nm">{room.icon} {room.number && room.number !== "F" ? `${room.number} · ` : ""}{room.stage ?? room.title}</span>
                        <span className="cnt">{doneN}/{ls.length}</span>
                      </button>
                      {isOpen && (
                        <ul role="group">
                        {s.locks.filter((l) => l.room === room.id).map((l) => (
                      <li key={l.id} role="treeitem" aria-selected={l.status === "open" ? active === "current" : active === `lvl:${l.id}`}>
                        <button
                          className={`node level ${l.status} ${(l.status === "open" ? active === "current" : active === `lvl:${l.id}`) ? "sel" : ""}`}
                          disabled={l.status === "locked"}
                          title={l.status === "locked" ? (gl ? "Bloqueado: supera os niveis anteriores" : "Bloqueado: superad los niveles anteriores") : l.title}
                          onClick={() => (l.status === "open" ? setActive("current") : open(`lvl:${l.id}`))}
                        >
                          <span className="ico" aria-hidden="true">{l.status === "done" ? "✔" : l.status === "open" ? "▶" : "🔒"}</span>
                          <span className="nm">{l.title}</span>
                        </button>
                      </li>
                    ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            </div>
          </div>
          <HSash label={gl ? "Cambiar a altura das seccións" : "Cambiar la altura de las secciones"} onStart={() => { baseH.current = heights(); }} onMove={(dy) => resizePair(0, dy, baseH.current)} onKey={(dy) => resizePair(0, dy, heights())} />
          <div className="section" data-tour="project" ref={(el) => { secRefs.current[1] = el; }}>
            <button className="secthead" aria-expanded={!closed.includes("project")} onClick={() => toggle("project")}>{closed.includes("project") ? "▸" : "▾"} {gl ? "PROXECTO" : "PROYECTO"}</button>
            <div className="sectbody">
            {!closed.includes("project") && (
              <ul className="tree" role="tree" aria-label={gl ? "Ficheiros do proxecto" : "Ficheros del proyecto"}>
                {files.map((f) => (
                  <li key={f.dir} role="treeitem" aria-expanded={!closed.includes(f.dir)}>
                    <button className="node folder" onClick={() => toggle(f.dir)}><span className="ico" aria-hidden="true">{closed.includes(f.dir) ? "▸" : "▾"}</span><span className="nm">{f.dir}</span></button>
                    {!closed.includes(f.dir) && (
                      <ul role="group">
                        {f.paths.map((p) => (
                          <li key={p} role="treeitem" aria-selected={active === `file:${p}`}>
                            <button className={`node file ${active === `file:${p}` ? "sel" : ""}`} onClick={() => open(`file:${p}`)}>
                              <span className={`ico k-${kindOf(p)}`} aria-hidden="true">{FILE_ICON[kindOf(p)]}</span><span className="nm">{base(p)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
            </div>
          </div>
          <HSash label={gl ? "Cambiar a altura das seccións" : "Cambiar la altura de las secciones"} onStart={() => { baseH.current = heights(); }} onMove={(dy) => resizePair(1, dy, baseH.current)} onKey={(dy) => resizePair(1, dy, heights())} />
          <div className="section" data-tour="db" ref={(el) => { secRefs.current[2] = el; }}>
            <button className="secthead" aria-expanded={!closed.includes("dbsec")} onClick={() => toggle("dbsec")}>{closed.includes("dbsec") ? "▸" : "▾"} BASE DE DATOS</button>
            <div className="sectbody">
            {!closed.includes("dbsec") && <DbTree tables={db.tables} started={db.started} lang={lang} active={active} closed={closed} toggle={toggle} onOpen={(full) => open(`db:${full}`)} />}
            </div>
          </div>
          </div>
        </aside>

        <Sash label={gl ? "Cambiar o ancho do explorador" : "Cambiar el ancho del explorador"} onDrag={resizeLeft} onStep={(d) => resizeLeft(left + d)} />

        <main className="editor">
          <div className="tabbar" role="tablist" aria-label={gl ? "Editores abertos" : "Editores abiertos"} data-tour="tabs">
            {tabs.map((id) => (
              <div key={id} className={`etab ${active === id ? "on" : ""} ${id === "current" ? "pinned" : ""}`}>
                <button role="tab" aria-selected={active === id} className="etab-main" onClick={() => setActive(id)} title={tabLabel(id)}>{tabLabel(id)}</button>
                {id !== "current" && <button className="etab-x" aria-label={`${gl ? "Pechar" : "Cerrar"} ${tabLabel(id)}`} onClick={() => close(id)}>×</button>}
              </div>
            ))}
          </div>
          <div className="panes">
            <section className="pane" role="tabpanel" aria-label={gl ? "Nivel actual" : "Nivel actual"} hidden={active !== "current"} data-tour="pane">
              {!introSeen ? (
                <Intro lang={lang} onDone={() => { store.write(`ca_intro_${teamId}`, "1"); setIntroSeen(true); setTouring(true); }} />
              ) : needBrief && curRoom ? (
                <RoomBriefing room={curRoom} s={s} lang={lang} again={briefAgain} onGo={doneBrief} />
              ) : lock ? (
                <LevelDesk key={lock.id} s={s} lock={lock} teamId={teamId} lang={lang} t={t} project={project} sheet={sheet} serverNow={serverNow} refresh={refresh} onRoomInfo={() => setBriefAgain(true)} />
              ) : (
                <CommissionPanel teamId={teamId} lang={lang} />
              )}
            </section>
            {tabs.filter((id) => id !== "current").map((id) => (
              <section key={id} className="pane" role="tabpanel" aria-label={tabLabel(id)} hidden={active !== id}>
                {id.startsWith("lvl:")
                  ? (() => { const l = s.locks.find((x) => x.id === id.slice(4)); return l ? <LevelDesk key={l.id + l.status} s={s} lock={l} teamId={teamId} lang={lang} t={t} project={project} sheet={sheet} serverNow={serverNow} refresh={refresh} /> : null; })()
                  : id.startsWith("db:") ? (active === id && <DbTableView full={id.slice(3)} lang={lang} />) : active === id && <FileViewer path={id.slice(5)} lang={lang} project={project} docs={s.docs} />}
              </section>
            ))}
          </div>
        </main>

        <Sash label={gl ? "Cambiar o ancho do asistente" : "Cambiar el ancho del asistente"} onDrag={(x) => resizeRight(window.innerWidth - x)} onStep={(d) => resizeRight(right - d)} />

        <aside className="side assistant-side" aria-label={gl ? "Asistente de IA" : "Asistente de IA"}>
          <LumiChat teamId={teamId} lang={lang} s={s} serverNow={serverNow} />
        </aside>
      </div>

      <footer className="status" aria-label={gl ? "Estado" : "Estado"} data-tour="status">
        <div className="timer" role="timer" aria-live="off" title={gl ? "Tempo ata a Comisión (13:00)" : "Tiempo hasta la Comisión (13:00)"}>⏱ {fmt(remaining)}</div>
        <MeterChip k="score" label={gl ? "Puntos" : "Puntos"} value={s.score} delta={fb.flash.score} bar={false} />
        {(["trust", "compliance", "quality"] as const).map((k) => <MeterChip key={k} k={k} label={t(`meters.${k}`)} value={s.meters[k]} delta={fb.flash[k]} />)}
        <span className="statushelp" data-tour="statushelp">
          <MetersLegend lang={lang} />
          <GlossaryPanel entries={s.glossary} lang={lang} />
          <button className="ghost" onClick={() => { store.write(`ca_intro_${teamId}`, ""); setIntroSeen(false); setActive("current"); }}>{gl ? "Como se xoga" : "Cómo se juega"}</button>
          <button className="ghost" onClick={() => { setActive("current"); setTouring(true); }}>{gl ? "Guía da pantalla" : "Guía de la pantalla"}</button>
        </span>
        <span className="grow" />
        <ThemeToggle lang={lang} />
        <label className="lang">
          <span className="sr">Idioma</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>{LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</select>
        </label>
      </footer>
      <Toasts toasts={fb.toasts} dismiss={fb.dismiss} />
      {touring && <Tour lang={lang} onDone={() => setTouring(false)} />}
    </div>
  );
}
