import { useState } from "react";
import type { Lang, LockStateView, Project, TeamState } from "@codigo-alta/shared";
import { api, ApiError } from "./api";
import { Wizard } from "./Wizard";
import { ModelBuilder } from "./ModelBuilder";
import { VerifyPanel } from "./Verify";
import { PrivacyRadar } from "./Radar";
import { PatientCompare } from "./Compare";
import { GuidePanel } from "./Explain";
import { emit, setDraft } from "./workContext";
import { noteAction } from "./Feedback";
import { EvidenceBoard, EvidenceCounts, KpiForm, ProtocolForm, QuickChecks, StarCanvas, VerdictForm } from "./M5Tools";
import { DashboardBuilder } from "./Dashboard";
import { NpcChat } from "./Chat";
import { QueryLab } from "./QueryLab";
import { MlEquity, MlThreshold, MlTrain } from "./MlLab";
import { CommissionPanel } from "./Commission";

type L2 = { es: string; gl: string };
const GROUPS: Record<string, L2> = {
  frag_h3: { es: "Altas y reingresos del mismo día (fragmentación)", gl: "Altas e reingresos do mesmo día (fragmentación)" },
  negative_stay: { es: "Estancias negativas (alta antes del ingreso)", gl: "Estadías negativas (alta antes do ingreso)" },
  post_mortem: { es: "Encuentros posteriores al fallecimiento", gl: "Encontros posteriores ao falecemento" },
};
const QUESTIONS: Record<string, L2> = {
  q1: { es: "Ventana de reingreso", gl: "Ventá de reingreso" },
  q2: { es: "¿Se fusionan ingresos separados por un día o menos?", gl: "Fusiónanse ingresos separados por un día ou menos?" },
  q3: { es: "¿Qué clases de encuentro cuentan como ingreso?", gl: "Que clases de encontro contan como ingreso?" },
  q4: { es: "Exclusiones", gl: "Exclusións" },
};
const KPI: Record<string, L2> = {
  kpi: { es: "Cómo se calcula la tasa", gl: "Como se calcula a taxa" },
  min_n: { es: "Desde cuántas altas se publica la tasa de un centro", gl: "Desde cantas altas se publica a taxa dun centro" },
  small_center: { es: "Qué hacer con la Clínica Illas Cíes", gl: "Que facer coa Clínica Illas Cíes" },
};
/** Plain-words name of an item the server says is wrong (it never says what the right value is). */
function itemLabel(lockId: string, id: string, lang: Lang, project: Project | null): string {
  const gl = lang === "gl";
  if (lockId === "r1a_bandeja") return `${gl ? "Ficheiro" : "Fichero"} ${id}`;
  if (lockId === "r1c_ada") return `${gl ? "Afirmación" : "Afirmación"} ${id.replace(/^c/, "")}`;
  if (lockId === "r3a_protocolo") return QUESTIONS[id]?.[lang] ?? id;
  if (lockId === "r4a_pruebas" || lockId === "r4c_veredicto") return GROUPS[id]?.[lang] ?? id;
  if (lockId === "r5a_kpi") return KPI[id]?.[lang] ?? id;
  if (lockId === "r3b_estrella") return id.startsWith("type:") ? `${gl ? "Tipo da táboa" : "Tipo de la tabla"} ${id.slice(5)} (${gl ? "feito ou dimensión" : "hecho o dimensión"})` : `${gl ? "Unión" : "Unión"} ${id.slice(5).replace(">", " → ")}`;
  if (lockId === "r3c_modelo") {
    if (id === "failed") return gl ? "Aínda hai tests que fallan" : "Aún hay tests que fallan";
    const [model, slot] = id.split(":");
    const lbl = (project?.models.find((m) => m.name === model)?.slots?.[slot] as any)?.label;
    return `${model} · ${typeof lbl === "string" ? lbl : lbl?.[lang] ?? slot}`;
  }
  return id;
}

export const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

interface Props {
  s: TeamState; lock: LockStateView; teamId: string; lang: Lang; t: (k: string) => string;
  project: Project | null; sheet: Record<string, any> | null; serverNow: number; refresh: () => void;
  /** reopen the room briefing */
  onRoomInfo?: () => void;
}

/** One level of the game. The open level is interactive; a level already solved is shown read-only (story, guide and the hints used). */
export function LevelDesk({ s, lock, teamId, lang, t, project, sheet, refresh, onRoomInfo }: Props) {
  const gl = lang === "gl";
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [code, setCode] = useState("");
  const [bad, setBad] = useState<{ ids: string[]; missing: number } | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch (x) { const e = x as ApiError; setMsg({ kind: "err", text: e.code === "hint_gate" ? `${e.message} (${Math.ceil(e.extra.waitSeconds / 60)} min)` : e.message }); }
  };
  const sendWith = async (c: string, fallback?: string) => {
    setMsg(null); setBad(null);
    noteAction(`${gl ? "Entrega" : "Entrega"}: ${lock.title}`);
    let res: Awaited<ReturnType<typeof api.submit>> | undefined;
    await act(async () => { const r = await api.submit(teamId, c, lang); res = r; setBad(!r.ok && ((r.badItems?.length ?? 0) > 0 || (r.missingCount ?? 0) > 0) ? { ids: (r.badItems ?? []).map((x) => x.id), missing: r.missingCount ?? 0 } : null); setMsg(r.ok ? { kind: "ok", text: t("lock.correct") } : { kind: "err", text: fallback ?? r.feedback ?? t("lock.wrong") }); if (r.ok) setCode(""); });
    return res;
  };
  const send = async (c: string, fallback?: string): Promise<void> => { await sendWith(c, fallback); };
  const open = lock.status === "open";
  const wrong = (es: string, g: string) => (gl ? g : es);
  const room = s.rooms.find((r) => r.id === lock.room);
  const inRoom = s.locks.filter((l) => l.room === lock.room);
  const pos = inRoom.findIndex((l) => l.id === lock.id) + 1;

  return (
    <div className="desk">
      {open && lock.room === "R6" && (
        <p className="skipbonus">{gl ? "Esta sala é un bonus opcional." : "Esta sala es un bonus opcional."} <button className="ghost" onClick={() => { if (window.confirm(gl ? "Saltar o laboratorio e pasar directamente á Comisión?" : "¿Saltar el laboratorio y pasar directamente a la Comisión?")) act(() => api.skipBonus(teamId)); }}>⏭ {gl ? "Saltar á Comisión" : "Saltar a la Comisión"}</button></p>
      )}
      <header className="lvlhead">
        {room && <button className="lvlroom" onClick={onRoomInfo} title={gl ? "De que vai esta sala" : "De qué va esta sala"}>{room.icon} {room.number === "F" ? "" : `${gl ? "Sala" : "Sala"} ${room.number} · `}{room.stage} · {gl ? "nivel" : "nivel"} {pos}/{inRoom.length} <span aria-hidden="true">ⓘ</span></button>}
        <h2>{lock.title}</h2>
        <span className="lvlmeta">🏆 {lock.points} {gl ? "puntos" : "puntos"} · ⏱ ~{lock.timeTargetMin} min</span>
      </header>
      {!open && <p className="done-banner">✔ {gl ? "Nivel superado. Podedes repasar de que ía, pero xa non se pode cambiar." : "Nivel superado. Podéis repasar de qué iba, pero ya no se puede cambiar."}</p>}
      <section className="mission" data-tour="mission"><b>🎯 {gl ? "Misión" : "Misión"}</b><p className="story">{lock.story}</p></section>
      {lock.guide && <GuidePanel key={lock.id + lang} guide={lock.guide} lang={lang} memoKey={`ca_guide_${teamId}_${lock.id}`} />}
      {open && (
        <>
          {lock.decision && (
            <fieldset>
              <legend>{gl ? "Decide" : "Decide"}</legend>
              {lock.decision.options.map((o) => (
                <button key={o.id} className="option" onClick={() => { noteAction(`${gl ? "Decisión" : "Decisión"}: «${o.label}»`); act(() => api.decide(teamId, lock.id, o.id)); }}>
                  <b>{o.label}</b>{o.explain && <small>{o.explain}</small>}
                </button>
              ))}
            </fieldset>
          )}
          {!lock.decision && lock.tools.includes("load_wizard") && (
            <Wizard teamId={teamId} lang={lang} sheet={sheet} done={false} onSubmit={(report) => send(report, wrong("Alguna carga no coincide con lo esperado. Revisa los ficheros con filas en rojo y los acentos.", "Algunha carga non coincide co esperado. Revisa os ficheiros marcados en vermello e os acentos."))} />
          )}
          {!lock.decision && lock.tools.some((x) => x.startsWith("model_builder")) && project && (() => {
            const tool = lock.tools.find((x) => x.startsWith("model_builder"))!;
            const names = tool.includes(":") ? tool.split(":")[1].split("+") : undefined;
            return <ModelBuilder lockId={lock.id} teamId={teamId} lang={lang} project={project} names={names} noSubmit={!!names} done={false} onSubmit={(report) => send(report, wrong("La entrega no coincide: revisa los tests y las piezas elegidas.", "A entrega non coincide: revisa os tests e as pezas escollidas."))} />;
          })()}
          {lock.tools.includes("protocol_doc") && <ProtocolForm lang={lang} onSubmit={(r) => send(r, wrong("Alguna respuesta no cuadra con el protocolo: releedlo con calma.", "Algunha resposta non cadra co protocolo: relédeo con calma."))} />}
          {lock.tools.includes("star_canvas") && <StarCanvas lang={lang} onSubmit={(r) => send(r, wrong("El esquema aún no es correcto: un hecho va en el centro y las dimensiones no se conectan entre sí.", "O esquema aínda non é correcto: un feito vai no centro e as dimensións non se conectan entre si."))} />}
          {lock.tools.includes("evidence_board") && <EvidenceBoard lang={lang} onSubmit={(r) => send(r, wrong("Alguna causa no encaja: mirad fechas y centros.", "Algunha causa non encaixa: mirade datas e centros."))} />}
          {lock.tools.includes("verdict_form") && <VerdictForm lang={lang} onSubmit={(r) => send(r, wrong("Algún tratamiento no es el más prudente: si dudáis de un dato clínico, no lo inventéis.", "Algún tratamento non é o máis prudente: se dubidades dun dato clínico, non o inventes."))} />}
          {lock.tools.includes("evidence_counts") && <EvidenceCounts lang={lang} />}
          {lock.tools.includes("kpi_form") && <KpiForm lang={lang} onSubmit={(r) => send(r, wrong("Esa definición no evita las trampas de la tasa: pensad en el denominador y en los centros pequeños.", "Esa definición non evita as trampas da taxa: pensade no denominador e nos centros pequenos."))} />}
          {lock.tools.includes("quick_checks") && <QuickChecks teamId={teamId} lang={lang} lockId={lock.id} />}
          {lock.tools.includes("dashboard_builder") && <DashboardBuilder key={lock.id} teamId={teamId} lang={lang} review={lock.tools.includes("critic_panel")} onSubmit={(spec) => send(spec, wrong("El crítico aún ve problemas importantes.", "O crítico aínda ve problemas importantes."))} />}
          {lock.tools.includes("npc_chat") && <NpcChat teamId={teamId} lang={lang} onClue={refresh} />}
          {lock.tools.includes("verify_panel") && <VerifyPanel teamId={teamId} lockId={lock.id} lang={lang} onSubmit={(report) => send(report)} />}
          {lock.tools.includes("privacy_radar") && <PrivacyRadar lang={lang} onSubmit={(report) => sendWith(report)} />}
          {lock.tools.includes("query_lab") && <QueryLab teamId={teamId} lang={lang} />}
          {lock.tools.includes("ml_train") && <MlTrain teamId={teamId} lang={lang} onSubmit={(r) => send(r)} />}
          {lock.tools.includes("ml_threshold") && <MlThreshold teamId={teamId} lang={lang} onSubmit={(r) => send(r)} />}
          {lock.tools.includes("ml_equity") && <MlEquity teamId={teamId} lang={lang} onSubmit={(r) => send(r)} />}
          {lock.tools.includes("commission") && <CommissionPanel teamId={teamId} lang={lang} />}
          {lock.tools.includes("patient_compare") && <PatientCompare teamId={teamId} lang={lang} />}
          {!lock.decision && !lock.tools.some((x) => ["load_wizard", "verify_panel", "privacy_radar", "protocol_doc", "star_canvas", "evidence_board", "verdict_form", "kpi_form", "dashboard_builder", "npc_chat", "ml_train", "ml_threshold", "ml_equity", "commission"].includes(x) || (x.startsWith("model_builder") && !x.includes(":"))) && (
            <form onSubmit={async (e) => { e.preventDefault(); setMsg(null); noteAction(`${gl ? "Entrega" : "Entrega"}: ${lock.title}`); await act(async () => { const r = await api.submit(teamId, code); setMsg(r.ok ? { kind: "ok", text: t("lock.correct") } : { kind: "err", text: t("lock.wrong") }); if (r.ok) setCode(""); }); }}>
              <div className="answerbox" data-tour="answer">
                <b>✍️ {gl ? "Que tedes que escribir" : "Qué tenéis que escribir"}</b>
                <p>{lock.answerHint ?? (gl ? "Escribide a resposta que pide a misión e premede «Probar»." : "Escribid la respuesta que pide la misión y pulsad «Probar».")}</p>
                <div className="answerrow">
                  <label>{t("lock.code")}<input value={code} onChange={(e) => { setCode(e.target.value); setDraft(lock.id, e.target.value, `Respuesta escrita (sin entregar): «${e.target.value}»`); }} autoComplete="off" required maxLength={80} /></label>
                  <button type="submit" className="primary">{t("lock.try")}</button>
                </div>
              </div>
            </form>
          )}
          <p aria-live="polite" className={msg?.kind === "ok" ? "ok" : "err"}>{msg?.text}</p>
          {bad && (
            <div className="badcols" role="alert">
              <b>⚠ {gl ? "Estes elementos non están ben:" : "Estos elementos no están bien:"}</b>
              {bad.ids.length > 0 && <ul>{bad.ids.map((id) => <li key={id}>{itemLabel(lock.id, id, lang, project)}</li>)}</ul>}
              {bad.missing > 0 && <p>{gl ? `Ademais, fáltanche ${bad.missing} elemento(s) por poñer ben (non che dicimos cales).` : `Además, te faltan ${bad.missing} elemento(s) por poner bien (no te decimos cuáles).`}</p>}
              <small>{gl ? "Revisa só eses: o resto vai ben. Se non sabes por onde, mira os documentos da carpeta docs/." : "Revisa solo esos: el resto va bien. Si no sabes por dónde, mira los documentos de la carpeta docs/."}</small>
            </div>
          )}
        </>
      )}
      {open && (
        <p className="stuck">🤔 {gl ? "Atascados?" : "¿Atascados?"} <button className="ghost" onClick={() => emit({ type: "lumi:ask" })}>✨ {gl ? "Preguntádelle a Lumi" : "Preguntad a Lumi"}</button> <small className="hint-small">{gl ? "Sabe o que estades a probar e pode darvos pistas." : "Sabe lo que estáis probando y puede daros pistas."}</small></p>
      )}
      {(lock.hints.length > 0 || lock.solution) && (
        <div className="hints">
          <h4>{gl ? "Axudas que vos deu Lumi" : "Ayudas que os ha dado Lumi"}</h4>
          <ol>{lock.hints.map((h, i) => <li key={i}>{h}</li>)}</ol>
          {lock.solution && <p className="solution">🔑 {lock.solution}</p>}
        </div>
      )}
    </div>
  );
}
