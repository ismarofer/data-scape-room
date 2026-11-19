import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { analyze, buildReport, compile, consolidateEncounters, dag, decode, fileReport, FILE_SPECS, closure, guardSql, loadRaw, runProject, type FileOpts } from "./index";
import { createNodeEngine, type NodeEngine } from "./node/duck-node";
import { loadModels } from "../../../apps/server/src/models";

const root = path.resolve(__dirname, "../../..");
export const TRUTH: Record<string, FileOpts> = Object.fromEntries(
  FILE_SPECS.map((s) => [
    s.name,
    (s.name.includes("H3")
      ? { delimiter: ";", encoding: "latin-1", dateFormat: "dmy_hm" }
      : { delimiter: ",", encoding: "utf-8", dateFormat: s.dateCols.length ? "iso" : "none" }) as FileOpts,
  ]),
);
const answers = JSON.parse(fs.readFileSync(path.join(root, "data/dist/answers.json"), "utf8"));
const { models, tests } = loadModels(path.join(root, "content"));
const correct = Object.fromEntries(
  models.map((m) => [m.name, Object.fromEntries(Object.entries(m.slots ?? {}).map(([k, d]) => [k, d.options.find((o) => o.correct)!.id]))]),
);

let eng: NodeEngine;
const reports: string[] = [];
beforeAll(async () => {
  eng = await createNodeEngine();
  for (const spec of FILE_SPECS) {
    const o = TRUTH[spec.name];
    const a = analyze(decode(fs.readFileSync(path.join(root, "data/dist/raw", spec.name)), o.encoding), o, spec);
    reports.push(fileReport(a, spec));
    await loadRaw(eng, spec.name.replace(".csv", "").toLowerCase(), a);
  }
  await consolidateEncounters(eng, FILE_SPECS.filter((s) => s.name.startsWith("encounters")).map((s) => s.name.replace(".csv", "").toLowerCase()));
}, 180_000);

describe("R1A loading wizard (truth options)", () => {
  it("matches the generator's row counts and rejections", () => {
    const exp = JSON.parse(fs.readFileSync(path.join(root, "data/work/expected_files.json"), "utf8"));
    for (const r of reports) {
      const [name, rows, rej] = r.split("|");
      expect(Number(rows.split("=")[1])).toBe(exp[name].rows_loaded);
      expect(Number(rej.split("=")[1])).toBe(exp[name].rows_rejected);
      expect(r).toContain("datefail=0");
      expect(r).toContain("moji=0");
    }
  });
  it("wrong options are detected", () => {
    const spec = FILE_SPECS.find((s) => s.name === "encounters_H3.csv")!;
    const bytes = fs.readFileSync(path.join(root, "data/dist/raw", spec.name));
    expect(analyze(decode(bytes, "utf-8"), { ...TRUTH[spec.name], encoding: "utf-8" }, spec).mojibake).toBeGreaterThan(0);
    expect(analyze(decode(bytes, "latin-1"), { ...TRUTH[spec.name], dateFormat: "iso" }, spec).dateFailures).toBeGreaterThan(0);
    expect(analyze(decode(bytes, "latin-1"), { ...TRUTH[spec.name], delimiter: "," }, spec).header).toHaveLength(1);
  });
});

describe("dbt mini-runner on the loaded raw layer (R2B)", () => {
  it("builds a valid DAG and compiles refs/sources/slots", () => {
    const d = dag(models);
    expect(d.order).toContain("stg_patients");
    const sql = compile(models.find((m) => m.name === "stg_encounters")!, correct.stg_encounters);
    expect(sql).toContain("raw.encounters");
    expect(sql).not.toContain("{{");
  });
  it("correct slots pass every test and reproduce the canonical row counts", async () => {
    const STG = ["stg_patients", "stg_encounters"];
    const r = await runProject(eng, { models, tests }, correct, { only: STG });
    expect(r.tests.filter((t) => t.status !== "pass").map((t) => `${t.test}: ${t.message}`)).toEqual([]);
    const rows = Object.fromEntries(r.models.map((m) => [m.model, m.rows]));
    expect(rows.stg_encounters).toBe(answers.r1b_unique_encounters.value);
    expect(rows.stg_patients).toBe(answers.r2c_unique_patients.value + 12);
    expect(buildReport(r, Object.fromEntries(STG.map((m) => [m, correct[m]])))).toContain("failed[0]");
  }, 180_000);
  it("wrong choices produce readable failures", async () => {
    const bad = { ...correct, stg_encounters: { date_cast: "try_cast", class_norm: "as_is", dedupe: "keep_all" } };
    const r = await runProject(eng, { models, tests }, bad, { only: ["stg_patients", "stg_encounters"] });
    const failed = r.tests.filter((t) => t.status === "fail").map((t) => t.test).join();
    expect(failed).toMatch(/not_null\(start_ts\)/);
    expect(failed).toMatch(/unique\(encounter_id\)/);
    expect(failed).toMatch(/accepted_values\(encounter_class\)/);
    const pk = await runProject(eng, { models, tests }, { ...correct, stg_encounters: { ...correct.stg_encounters, date_cast: "plain_cast" } }, { only: ["stg_patients", "stg_encounters"] });
    expect(pk.models.find((m) => m.model === "stg_encounters")!.status).toBe("error");
  }, 180_000);
  it("R3C: episode + readmission models reproduce the canonical SQL answer; expression test warns on negative stays", async () => {
    const r = await runProject(eng, { models, tests }, correct, { only: closure(models, ["fct_admission"]) });
    expect(r.models.every((m) => m.status === "ok")).toBe(true);
    const n = (await eng.query("select sum(is_readmission_30d::int) as n from marts.fct_admission"))[0].n;
    expect(n).toBe(answers.r3c_readmissions_base.value);
    expect(r.tests.filter((t) => t.status === "fail")).toEqual([]);
    expect(r.tests.find((t) => t.status === "warn")?.message).toMatch(/no cumplen/);
    const wrong = await runProject(eng, { models, tests }, { ...correct, fct_admission: { window: "lte_30" } }, { only: closure(models, ["fct_admission"]) });
    expect((await eng.query("select sum(is_readmission_30d::int) as n from marts.fct_admission"))[0].n).not.toBe(answers.r3c_readmissions_base.value);
    void wrong;
  }, 180_000);
  it("guards player SQL", () => {
    expect(guardSql("select * from raw.patients").ok).toBe(true);
    expect(guardSql("copy raw.patients to 'x.csv'").ok).toBe(false);
    expect(guardSql("select * from read_csv('/etc/passwd')").ok).toBe(false);
    expect(guardSql("select 1; drop table x").ok).toBe(false);
    expect(guardSql("select 'copy' as w").ok).toBe(true);
  });
});
