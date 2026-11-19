import path from "node:path";
import fs from "node:fs";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { loadAnswers, loadContent, loadEnv } from "./content.js";
import { openDb } from "./db.js";
import { Engine, GameError } from "./engine.js";
import { buildApp } from "./app.js";
import { Commission, loadCommission } from "./commission.js";
import { parseMlCsv } from "@codigo-alta/shared";

const root = path.resolve(__dirname, "../../..");
loadEnv(root);
const SALT = process.env.ANSWER_SALT ?? "dev-salt-change-me";
const content = loadContent(path.join(root, "content"));
const answers = { ...loadAnswers(path.join(root, "data/dist/answers.public.json")), ...loadAnswers(path.join(root, "data/dist/build_answers.public.json")) };
const answersFull = JSON.parse(fs.readFileSync(path.join(root, "data/dist/answers.json"), "utf8"));

const mlFile = path.join(root, "data/dist/ml/ml_features.csv");
const mlRows = fs.existsSync(mlFile) ? parseMlCsv(fs.readFileSync(mlFile, "utf8")) : undefined;
function make(now = { t: 1_000_000 }) {
  const events: string[] = [];
  const rubrics = { "privacy_rubric.yaml": YAML.parse(fs.readFileSync(path.join(root, "content/privacy_rubric.yaml"), "utf8")) };
  const claimIds = JSON.parse(fs.readFileSync(path.join(root, "data/dist/r1c_claims.public.json"), "utf8")).map((c: any) => c.id);
  const engine = new Engine(openDb(":memory:"), { content, answers, rubrics, claimIds, mlRows, salt: SALT, now: () => now.t, onChange: (_t, ty) => events.push(ty) });
  return { engine, now, events };
}
const sol = (id: string) => JSON.parse(fs.readFileSync(path.join(root, "solutions", `${id}.json`), "utf8"));
const solveTo = (e: Engine, teamId: string, ids: string[]) => ids.forEach((id) => expect(e.submit(teamId, sol(id).code).ok).toBe(true));
const join = (e: Engine, _code: string, alias = "Equipo Luz") => e.join({ teamAlias: alias });

describe("engine", () => {
  it("plays the tutorial lock end to end and resumes the same team", () => {
    const { engine, events } = make();
    const s = engine.createSession();
    const a = join(engine, s.code);
    expect(join(engine, s.code).teamId).toBe(a.teamId); // reload / rejoin on the same PC
    expect(engine.state(a.teamId).currentLockId).toBe("p0_tutorial");
    expect(engine.submit(a.teamId, "mal").ok).toBe(false);
    expect(engine.submit(a.teamId, " atlántico ").ok).toBe(true); // normalisation: case, accents, spaces
    const st = engine.state(a.teamId);
    expect(st.score).toBe(20);
    expect(st.currentLockId).toBe("r1a_bandeja");
    expect(events).toContain("state_update");
  });

  it("requires the decision before the code, applies effects and ledger", () => {
    const { engine } = make();
    const s = engine.createSession();
    const { teamId } = join(engine, s.code);
    solveTo(engine, teamId, ["p0_tutorial", "r1a_bandeja"]);
    expect(engine.state(teamId).currentLockId).toBe("r1b_reenvio");
    expect(() => engine.submit(teamId, "123")).toThrow(GameError);
    engine.decide(teamId, "r1b_reenvio", "union_all");
    const m = engine.state(teamId).meters;
    expect(m.quality).toBe(30);
    expect(m.trust).toBe(55);
    const code = String(answersFull.r1b_unique_encounters.value);
    expect(engine.submit(teamId, code.padStart(10, "0")).ok).toBe(true); // leading zeros accepted
    expect(engine.state(teamId).currentLockId).toBe("r1c_ada");
    solveTo(engine, teamId, ["r1c_ada", "r2a_radar"]);
    expect(engine.state(teamId).currentLockId).toBe("r3a_protocolo");
    solveTo(engine, teamId, ["r3a_protocolo", "r3b_estrella", "r3c_modelo", "r4a_pruebas"]);
    expect(engine.state(teamId).currentLockId).toBe("r4b_entrevistas");
    expect(() => engine.submit(teamId, "x")).toThrow(/hablando/); // interview locks open only through the characters
    engine.addClues(teamId, ["C1", "C3"]);
    solveTo(engine, teamId, ["r4c_veredicto", "r4d_codigo", "r5a_kpi"]);
    expect(engine.submit(teamId, sol("r5b_dashboard").code).ok).toBe(true); // build mode: structure only
    const r5c = engine.submit(teamId, sol("r5b_dashboard").code); // review mode with the sloppy dashboard fails and lists findings
    expect(r5c.ok).toBe(false);
    expect(r5c.findings!.some((f) => f.id.startsWith("axis_zero"))).toBe(true);
    solveTo(engine, teamId, ["r5c_critico", "r5d_codigo"]);
    expect(engine.state(teamId).currentLockId).toBe("r6a_entrenar"); // after R5 comes the optional lab (R6), then the Commission
  });

  it("R1C: false positives cost points; R2A: critical privacy failures hurt compliance", () => {
    const { engine } = make();
    const s = engine.createSession();
    const { teamId } = join(engine, s.code);
    solveTo(engine, teamId, ["p0_tutorial", "r1a_bandeja"]);
    engine.decide(teamId, "r1b_reenvio", "latest_by_id");
    solveTo(engine, teamId, ["r1b_reenvio"]);
    const before = engine.state(teamId).score;
    const wrong = engine.submit(teamId, "c1;c2;c3");
    expect(wrong.ok).toBe(false);
    expect(wrong.feedback).toMatch(/falsa/);
    expect(engine.state(teamId).score).toBe(before - 10);
    expect(engine.submit(teamId, "c2").ok).toBe(false); // one false claim is still missing
    solveTo(engine, teamId, ["r1c_ada"]);
    const bad = engine.submit(teamId, sol("r2a_radar").code.replace("ssn=pseudonymize", "ssn=keep"));
    expect(bad.ok).toBe(false);
    expect(bad.badColumns).toContainEqual({ col: "ssn", kind: "critical" });
    expect(bad.badColumns!.map((b) => b.col)).toEqual(["ssn"]); // only the wrong column is reported
    expect(engine.state(teamId).meters.compliance).toBe(50);
    expect(engine.submit(teamId, sol("r2a_radar").code.replace("ssn=pseudonymize", "ssn=remove")).feedback).toMatch(/unir/);
    expect(engine.submit(teamId, sol("r2a_radar").code).ok).toBe(true);
  });

  it("Lumi's help ladder: hint 1 at once, later steps unlock with failed tries or time, the solution comes last and costs more", () => {
    const now = { t: 0 };
    const answerValues = Object.fromEntries(Object.entries(answersFull).map(([k, v]: [string, any]) => [k, v.value]));
    const engine = new Engine(openDb(":memory:"), { content, answers, salt: SALT, now: () => now.t, answerValues });
    engine.createSession();
    const { teamId } = join(engine, "");
    const help = () => engine.state(teamId).locks[0].help!;
    expect(help().next).toMatchObject({ level: 1, unlocked: true, penalty: 5 });
    expect(() => engine.hint(teamId, 2)).toThrow(/orden/);
    expect(engine.hint(teamId, 1).text).toMatch(/Costa/);
    expect(engine.state(teamId).score).toBe(-5);
    expect(engine.state(teamId).locks[0].hints).toHaveLength(1);
    // step 2 needs one failed try or 3 minutes
    expect(help().next).toMatchObject({ level: 2, unlocked: false, attemptsNeeded: 1 });
    expect(() => engine.hint(teamId, 2)).toThrow(/pronto/);
    engine.submit(teamId, "PACIFICO");
    expect(help().next!.unlocked).toBe(true);
    engine.hint(teamId, 2);
    // step 3 by time
    now.t += 6 * 60_000;
    engine.hint(teamId, 3);
    expect(help().next).toMatchObject({ level: 4, penalty: 40 });
    now.t += 4 * 60_000;
    const sol4 = engine.hint(teamId, 4);
    expect(sol4.text).toContain("ATLANTICO"); // the real value fills {answer}
    expect(engine.state(teamId).score).toBe(-(5 + 10 + 20 + 40));
    expect(engine.state(teamId).locks[0].solution).toContain("ATLANTICO");
    expect(help().next).toBeNull();
    expect(engine.state(teamId).locks[0].hints).toHaveLength(3);
  });
  it("the solution is never in the state before the team asks for it", () => {
    const { engine } = make();
    engine.createSession();
    const { teamId } = join(engine, "");
    expect(JSON.stringify(engine.state(teamId))).not.toMatch(/ATLANTICO/);
  });
  it("diagnose checks a draft without touching the game (attempts, score, meters)", () => {
    const { engine } = make();
    engine.createSession();
    const { teamId } = join(engine, "");
    solveTo(engine, teamId, ["p0_tutorial", "r1a_bandeja"]);
    engine.decide(teamId, "r1b_reenvio", "latest_by_id");
    solveTo(engine, teamId, ["r1b_reenvio", "r1c_ada"]);
    const before = engine.state(teamId);
    const d = engine.diagnose(teamId, sol("r2a_radar").code.replace("ssn=pseudonymize", "ssn=keep"))!;
    expect(d.ok).toBe(false);
    expect(d.wrong).toEqual(["ssn (critical)"]);
    expect(engine.diagnose(teamId, sol("r2a_radar").code)!.ok).toBe(true);
    const after = engine.state(teamId);
    expect(after.meters).toEqual(before.meters);
    expect(after.score).toBe(before.score);
    expect(after.locks.find((l) => l.id === "r2a_radar")!.attempts).toBe(0);
    // a failed submission is remembered (code + what was wrong) for Lumi
    engine.submit(teamId, sol("r2a_radar").code.replace("ssn=pseudonymize", "ssn=remove"));
    expect(engine.lastAttempts(teamId, "r2a_radar")[0]).toMatchObject({ ok: false, bad: ["ssn"] });
  });
  it("diagnose tells which model piece of R3C is wrong", () => {
    const { engine } = make();
    const e2 = new Engine(openDb(":memory:"), { content, answers, salt: SALT, slotKey: { int_admission_episodes: { class_filter: "inpatient", new_episode: "gap_1d" }, fct_admission: { window: "between_2_30" } } });
    void engine;
    e2.createSession();
    const { teamId } = e2.join({ teamAlias: "Piezas" });
    while (e2.state(teamId).currentLockId !== "r3c_modelo") e2.masterKey(teamId);
    const d = e2.diagnose(teamId, "slots:int_admission_episodes.class_filter=inpatient,int_admission_episodes.new_episode=any_gap,fct_admission.window=between_2_30")!;
    expect(d).toMatchObject({ ok: false, wrong: ["int_admission_episodes.new_episode"], missing: 0 });
    expect(e2.diagnose(teamId, "slots:int_admission_episodes.class_filter=inpatient,int_admission_episodes.new_episode=gap_1d,fct_admission.window=between_2_30")!.ok).toBe(true);
  });

  it("master key opens the lock with a penalty", () => {
    const { engine } = make();
    const s = engine.createSession();
    const { teamId } = join(engine, s.code);
    engine.masterKey(teamId);
    const st = engine.state(teamId);
    expect(st.score).toBe(-60);
    expect(st.currentLockId).toBe("r1a_bandeja");
  });

  it("blocks inappropriate team names", () => {
    const { engine } = make();
    const s = engine.createSession();
    expect(() => join(engine, s.code, "Los Joder")).toThrow(/nombre/);
  });

  it("never leaks answers or hashes in the state", () => {
    const { engine } = make();
    const s = engine.createSession();
    const { teamId } = join(engine, s.code);
    const json = JSON.stringify(engine.state(teamId));
    expect(json).not.toContain("ATLANTICO");
    expect(json).not.toMatch(/[0-9a-f]{64}/);
    expect(json).not.toContain(String(answersFull.r1b_unique_encounters.value));
  });

  it("wrong structured submissions say WHICH items are wrong, never the right values", () => {
    const { engine } = make();
    const s = engine.createSession();
    const { teamId } = join(engine, s.code);
    const to = (id: string) => { while (engine.state(teamId).currentLockId !== id) engine.masterKey(teamId); };
    to("r1c_ada");
    const c = engine.submit(teamId, "c1;c2;c3");
    expect(c.ok).toBe(false);
    expect(c.badItems).toEqual([{ id: "c1" }]);
    to("r3a_protocolo");
    const q = engine.submit(teamId, "q1=d7;q2=merge;q3=inpatient;q4=none");
    expect(q.badItems).toEqual([{ id: "q1" }, { id: "q4" }]);
    expect(q.missingCount).toBe(0);
    expect(JSON.stringify(q)).not.toContain("d30");
    to("r3b_estrella");
    const star = engine.submit(teamId, "types:dim_date=fact,dim_hospital=dim,dim_patient=dim,fct_admission=fact,fct_condition=fact|edges:fct_admission>dim_date,fct_admission>dim_hospital,dim_date>dim_patient");
    expect(star.badItems!.map((x) => x.id).sort()).toEqual(["edge:dim_date>dim_patient", "type:dim_date"]);
    expect(star.missingCount).toBe(2);
    to("r5a_kpi");
    expect(engine.submit(teamId, "kpi=readmit_count;min_n=n30;small_center=warn").badItems).toEqual([{ id: "kpi" }]);
  });
  it("project documents appear in the explorer when the level that needs them is reached, and stay", () => {
    const { engine } = make();
    const s = engine.createSession();
    const a = join(engine, s.code);
    expect(engine.state(a.teamId).docs).toEqual([]); // tutorial: nothing yet
    engine.masterKey(a.teamId); // -> r1a_bandeja
    const docs = engine.state(a.teamId).docs;
    expect(docs.map((d) => d.path)).toEqual(["docs/especificaciones-ficheros.md"]);
    expect(docs[0].body.length).toBeGreaterThan(50);
    engine.masterKey(a.teamId); // -> r1b: more documents, the old one is kept
    expect(engine.state(a.teamId).docs.length).toBeGreaterThan(1);
    expect(engine.state(a.teamId).docs.map((d) => d.path)).toContain("docs/especificaciones-ficheros.md");
  });
  it("any number of laptops share one team (same state)", () => {
    const { engine } = make();
    const s = engine.createSession();
    const a = join(engine, s.code);
    expect(join(engine, s.code).teamId).toBe(a.teamId);
    expect(join(engine, s.code).teamId).toBe(a.teamId);
  });
  it("help gates are shared by the whole team (two laptops, one team)", () => {
    const now = { t: 0 };
    const { engine } = make(now);
    const s = engine.createSession();
    const a = join(engine, s.code);
    const b = join(engine, s.code);
    engine.hint(a.teamId, 1);
    expect(() => engine.hint(b.teamId, 2)).toThrow(/pronto/);
    now.t += 3 * 60_000 + 1;
    expect(engine.hint(b.teamId, 2).level).toBe(2);
  });
  it("team kv store keeps tool state for any laptop", () => {
    const { engine, events } = make();
    const s = engine.createSession();
    const a = join(engine, s.code);
    expect(engine.kvGet(a.teamId, "wiz")).toBeNull();
    engine.kvSet(a.teamId, "wiz", JSON.stringify({ a: 1 }));
    expect(engine.kvGet(a.teamId, "wiz")).toBe('{"a":1}');
    expect(events).toContain("kv_update");
    expect(() => engine.kvSet(a.teamId, "Bad Key!", "x")).toThrow();
  });
});

describe("http api", () => {
  it("serves state, rejects bad pin, validates input", async () => {
    const { engine } = make();
    const app = buildApp({ engine, content, pin: "1234" });
    const bad = await app.inject({ method: "POST", url: "/api/facilitator/pause", payload: { paused: true } });
    expect(bad.statusCode).toBe(401);
    const code = engine.createSession().code;
    const j = await app.inject({ method: "POST", url: "/api/teams/join", payload: { sessionCode: code, teamAlias: "Mareas" } });
    expect(j.statusCode).toBe(200);
    const { teamId } = j.json();
    const wrong = await app.inject({ method: "POST", url: "/api/locks/submit", payload: { teamId, code: "nope" } });
    expect(wrong.json()).toMatchObject({ ok: false });
    const inv = await app.inject({ method: "POST", url: "/api/locks/submit", payload: { teamId } });
    expect(inv.statusCode).toBe(400);
    const gl = await app.inject({ method: "GET", url: `/api/teams/${teamId}/state?lang=gl` });
    expect(gl.json().locks[0].title).toBe("O primeiro cadeado");
    await app.close();
  });
});

describe("R6 laboratorio de riesgo y la Comisión", () => {
  const FULL = "edad,cronicas,estancia,previos,centro,sexo";
  const reach = (e: Engine, teamId: string, id: string) => { while (e.state(teamId).currentLockId !== id) e.masterKey(teamId); };
  it("R6A rejects the leaking variable and too few variables, accepts an honest model", () => {
    const { engine } = make();
    const { teamId } = join(engine, engine.createSession().code);
    reach(engine, teamId, "r6a_entrenar");
    expect(engine.submit(teamId, `features=${FULL},dias_hasta_siguiente_ingreso`).feedback).toMatch(/demasiado bueno/);
    expect(engine.submit(teamId, "features=sexo").feedback).toMatch(/pocas variables/);
    expect(engine.submit(teamId, "features=edad,sexo").feedback).toMatch(/azar/); // AUC too low
    expect(engine.submit(teamId, `features=${FULL}`).ok).toBe(true);
  });
  it("R6B needs calls within the 40/week capacity and enough sensitivity", () => {
    const { engine } = make();
    const { teamId } = join(engine, engine.createSession().code);
    reach(engine, teamId, "r6b_umbral");
    expect(engine.submit(teamId, `features=${FULL};threshold=0.1`).feedback).toMatch(/llamadas por semana/);
    expect(engine.submit(teamId, `features=${FULL};threshold=0.3`).feedback).toMatch(/pierden demasiados/);
    expect(engine.submit(teamId, `features=${FULL};threshold=0.16`).ok).toBe(true);
  });
  it("R6C wants the human-review decision with a justification that names the groups", () => {
    const { engine } = make();
    const { teamId } = join(engine, engine.createSession().code);
    reach(engine, teamId, "r6c_equidad");
    const t = "El modelo caza menos reingresos en mujeres que en hombres, por eso hace falta que una persona lo revise.";
    expect(engine.submit(teamId, `decision=deploy;text=${t}`).feedback).toMatch(/otra vez el gráfico/);
    expect(engine.submit(teamId, `decision=no_deploy;text=${t}`).feedback).toMatch(/prudente/);
    expect(engine.submit(teamId, "decision=deploy_review;text=Me parece bien porque sí, de verdad que sí.").feedback).toMatch(/nombrad los grupos/);
    expect(engine.submit(teamId, `decision=deploy_review;text=${t}`).ok).toBe(true);
    expect(engine.state(teamId).currentLockId).toBe("f_comision");
  });
  it("the bonus room can be skipped, and the Commission runs 6 turns (rules) to an ending with badges and a report", async () => {
    const { engine } = make();
    const { teamId } = join(engine, engine.createSession().code);
    reach(engine, teamId, "r6a_entrenar");
    engine.skipBonus(teamId);
    expect(engine.state(teamId).currentLockId).toBe("f_comision");
    const cc = content; void cc;
    const commission = new Commission(engine, undefined, loadCommission(path.join(root, "content")), {});
    const v0 = await commission.view(teamId, "es");
    expect(v0.turn).toBe(0);
    expect(v0.question!.persona.name).toMatch(/Valcárcel/);
    let v = v0;
    const good = "Hemos fijado un mínimo de 30 altas porque un centro con 3 ingresos da un 100 % por azar. Es un límite de nuestros datos, que son provisionales. Recomendamos revisar los centros pequeños aparte y proponemos un plan de seguimiento.";
    for (let i = 0; i < 6; i++) { v = await commission.answer(teamId, good, v.evidence.map((c) => c.id).slice(0, 2), "es"); }
    expect(v.done).toBe(true);
    expect(v.result!.votes).toHaveLength(3);
    expect(["approved", "conditions", "more_data"]).toContain(v.result!.ending);
    expect(v.result!.report.length).toBeGreaterThan(80);
    expect(engine.state(teamId).currentLockId).toBeNull();
    await expect(commission.answer(teamId, good, [], "es")).rejects.toThrow(/ya ha votado/);
  });
  it("a short or private answer is refused", async () => {
    const { engine } = make();
    const { teamId } = join(engine, engine.createSession().code);
    reach(engine, teamId, "f_comision");
    const commission = new Commission(engine, undefined, loadCommission(path.join(root, "content")), {});
    await commission.view(teamId, "es");
    await expect(commission.answer(teamId, "ok", [], "es")).rejects.toThrow();
    await expect(commission.answer(teamId, "Llamadme al 612345678 para que lo hablemos con calma", [], "es")).rejects.toThrow();
  });
});
