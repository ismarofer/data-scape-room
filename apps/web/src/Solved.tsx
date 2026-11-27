import { useEffect, useState } from "react";
import type { Lang, LockStateView, Project, TeamState } from "@codigo-alta/shared";
import { ensureCanon, getEngine } from "./duck";
import { Wizard } from "./Wizard";
import { ModelBuilder } from "./ModelBuilder";
import { VerifyPanel } from "./Verify";
import { PrivacyRadar } from "./Radar";
import { DashboardBuilder, useKpiMin } from "./Dashboard";
import { EvidenceCounts, KpiForm, StarCanvas, VerdictForm } from "./M5Tools";
import { MlEquity, MlThreshold, MlTrain } from "./MlLab";
import { CommissionPanel } from "./Commission";
import { restoreRaw, restoreWork } from "./raw";

const noop = async () => {};

/** A few figures read from the in-browser database (the team's calculation or the clean model), as a small table. */
function QueryTable({ sql, canon, caption, prep }: { sql: string; canon?: boolean; caption: string; prep?: () => Promise<unknown> }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  useEffect(() => { (async () => { if (canon) await ensureCanon(); if (prep) await prep(); setRows(await (await getEngine()).query(sql)); })().catch(() => setRows([])); }, [sql, canon]);
  if (!rows?.length) return null;
  return (
    <table className="prev solvedtable"><caption>{caption}</caption>
      <thead><tr>{Object.keys(rows[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>)}</tbody>
    </table>
  );
}

/** The interviews as they happened (the team's own conversation with each character). */
function Transcript({ teamId, npc, name, lang }: { teamId: string; npc: string; name: string; lang: Lang }) {
  const [msgs, setMsgs] = useState<{ role: string; text: string }[] | null>(null);
  useEffect(() => { fetch(`/api/ai/npc/history/${teamId}/${npc}`).then((r) => r.json()).then((d) => setMsgs(d.messages ?? [])).catch(() => setMsgs([])); }, [teamId, npc]);
  return (
    <div className="transcript">
      <h4>{name}</h4>
      {!msgs ? <p>…</p> : msgs.length === 0 ? <p className="hint-small">{lang === "gl" ? "Non lle preguntastes nada." : "No le preguntasteis nada."}</p>
        : <div className="thread">{msgs.map((m, i) => <p key={i} className={m.role === "user" ? "me" : "ai"}>{m.role !== "user" && <b>{name}: </b>}{m.text}</p>)}</div>}
    </div>
  );
}

/**
 * A level already passed: the same tool the team used, filled with what it delivered and disabled (a disabled fieldset
 * turns every control off; the delivery buttons are hidden). Results are recalculated where the tool shows them (the
 * model's figures and chart, the critic's review, the loader preview…). Levels passed with the facilitator's shortcut
 * have nothing delivered to show.
 */
export function SolvedView({ lock, s, teamId, lang, project, sheet }: { lock: LockStateView; s: TeamState; teamId: string; lang: Lang; project: Project | null; sheet: Record<string, any> | null }) {
  const es = lang === "es";
  const code = lock.mine?.code ?? "";
  const minN = useKpiMin(teamId);
  const answer = code ? <p className="solvedanswer">{es ? "Vuestra respuesta:" : "A vosa resposta:"} <b>{code}</b></p> : null;
  let body: React.ReactNode = null;
  switch (lock.id) {
    case "r1a_bandeja": body = <Wizard teamId={teamId} lang={lang} sheet={sheet} done onSubmit={noop} />; break;
    case "r1b_reenvio": body = (<>{answer}<QueryTable caption={es ? "Visitas cargadas (raw.encounters)" : "Visitas cargadas (raw.encounters)"} prep={() => restoreRaw(teamId)} sql="select count(*) as filas, count(distinct encounter_id) as visitas_distintas from raw.encounters" /></>); break;
    case "r1c_ada": body = code && <VerifyPanel teamId={teamId} lockId="r1c_ada" lang={lang} onSubmit={noop} initial={code} />; break;
    case "r2a_radar": body = code && <PrivacyRadar lang={lang} onSubmit={noop} initial={code} />; break;
    case "r3b_estrella": body = code && <StarCanvas lang={lang} onSubmit={noop} initial={code} />; break;
    case "r3c_modelo": body = (<>
      {project && <ModelBuilder teamId={teamId} lang={lang} project={project} names={["int_admission_episodes", "fct_admission"]} noSubmit done onSubmit={noop} />}
      <QueryTable prep={() => (project ? restoreWork(teamId, project) : Promise.resolve())} caption={es ? "Vuestro cálculo (marts.fct_admission)" : "O voso cálculo (marts.fct_admission)"} sql="select count(*) as episodios, sum(is_readmission_30d::int) as reingresos, round(100.0 * sum(is_readmission_30d::int) / count(*), 1) as tasa from marts.fct_admission" />
      {answer}
    </>); break;
    case "r4b_entrevistas": body = (<>
      <EvidenceCounts lang={lang} clues={s.clues ?? []} />
      <div className="mlgrid"><Transcript teamId={teamId} npc="noa" name="Noa · Informática" lang={lang} /><Transcript teamId={teamId} npc="brais" name={es ? "Brais · Admisiones" : "Brais · Admisións"} lang={lang} /></div>
    </>); break;
    case "r4c_veredicto": body = code && <VerdictForm lang={lang} onSubmit={noop} initial={code} />; break;
    case "r4d_codigo": body = (<><EvidenceCounts lang={lang} />{answer}</>); break;
    case "r5a_kpi": body = code && <KpiForm lang={lang} teamId={teamId} onSubmit={noop} initial={code} />; break;
    case "r5b_dashboard": body = <DashboardBuilder teamId={teamId} lang={lang} review={false} onSubmit={noop} initial={code || undefined} readOnly />; break;
    case "r5c_critico": body = <DashboardBuilder teamId={teamId} lang={lang} review onSubmit={noop} initial={code || undefined} readOnly />; break;
    case "r5d_codigo": body = (<>
      <QueryTable canon caption={es ? `Tasa por centro con vuestro mínimo (≥ ${minN} altas)` : `Taxa por centro co voso mínimo (≥ ${minN} altas)`} sql={`select organization_name as centro, count(*) as altas, round(100.0 * sum(is_readmission_30d::int) / count(*), 1) as tasa from canon.fct_admission_clean group by 1 having count(*) >= ${Math.max(1, Math.round(minN))} order by 3 desc`} />
      {answer}
    </>); break;
    case "r6a_entrenar": body = code && <MlTrain teamId={teamId} lang={lang} onSubmit={noop} initial={code} />; break;
    case "r6b_umbral": body = <MlThreshold teamId={teamId} lang={lang} onSubmit={noop} initial={code} />; break;
    case "r6c_equidad": body = code && <MlEquity teamId={teamId} lang={lang} onSubmit={noop} initial={code} />; break;
    case "f_comision": body = <CommissionPanel teamId={teamId} lang={lang} />; break;
    default: body = answer;
  }
  const opts = lock.mine?.options;
  if (!body && !opts) return <p className="hint-small solvedbox">{es ? "No hay registro de lo que entregasteis en este nivel (se pasó con un atajo del facilitador)." : "Non hai rexistro do que entregastes neste nivel (pasouse cun atallo do facilitador)."}</p>;
  return (
    <section className="solvedbox" aria-label={es ? "Lo que hicisteis" : "O que fixestes"}>
      <h3>📋 {es ? "Lo que hicisteis (solo lectura)" : "O que fixestes (só lectura)"}</h3>
      {opts && (
        <ul className="solvedopts">{opts.map((o) => <li key={o.label} className={o.chosen ? "on" : ""}>{o.chosen ? "✔" : "○"} <b>{o.label}</b>{o.explain && <small>{o.explain}</small>}{o.chosen && <em> ← {es ? "vuestra decisión" : "a vosa decisión"}</em>}</li>)}</ul>
      )}
      <fieldset disabled className="ro">{body}</fieldset>
    </section>
  );
}
