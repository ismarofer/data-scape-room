// Computes the expected reports for `build` locks (R1A wizard, R2B staging) by actually running the correct solution
// in DuckDB-WASM (node). Writes hashed answers for the server and solutions/ for speedrun tests.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, buildReport, itemizeReport, consolidateEncounters, decode, fileReport, FILE_SPECS, loadRaw, runProject } from "@codigo-alta/shared";
import { createNodeEngine } from "../packages/shared/src/node/duck-node";
import { loadEnv } from "../apps/server/src/content";
import { loadModels } from "../apps/server/src/models";
import { TRUTH } from "./truth";
import YAML from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(root);
const salt = process.env.ANSWER_SALT ?? "dev-salt-change-me";
const h = (key: string, v: string) => crypto.createHash("sha256").update(`${salt}:${key}:${v}`).digest("hex");

const eng = await createNodeEngine();
const reports: string[] = [];
for (const spec of FILE_SPECS) {
  const o = TRUTH[spec.name];
  const a = analyze(decode(fs.readFileSync(path.join(root, "data/dist/raw", spec.name)), o.encoding), o, spec);
  reports.push(fileReport(a, spec));
  await loadRaw(eng, spec.name.replace(".csv", "").toLowerCase(), a);
}
await consolidateEncounters(eng, FILE_SPECS.filter((s) => s.name.startsWith("encounters")).map((s) => s.name.replace(".csv", "").toLowerCase()));
const r1a = reports.sort().join("\n");

const { models, tests } = loadModels(path.join(root, "content"));
const choices = Object.fromEntries(models.map((m) => [m.name, Object.fromEntries(Object.entries(m.slots ?? {}).map(([k, d]) => [k, d.options.find((o) => o.correct)!.id]))]));
const STG = ["stg_patients", "stg_encounters"];
const run = await runProject(eng, { models, tests }, choices, { only: STG });
if (!run.ok || run.tests.some((t) => t.status !== "pass")) throw new Error("The correct solution does not pass its own tests");
const r2b = buildReport(run, Object.fromEntries(STG.map((m) => [m, choices[m]])));

const expected = YAML.parse(fs.readFileSync(path.join(root, "content/expected.yaml"), "utf8")) as Record<string, string>;
const answers = JSON.parse(fs.readFileSync(path.join(root, "data/dist/answers.json"), "utf8"));
const items = (k: string, report: string) => itemizeReport(k, report).map((it) => h(k, `item:${it.value}`));
const extra: Record<string, { report: string; sha256_salted: string; items: string[] }> = Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, { report: v, sha256_salted: h(k, v), items: items(k, v) }]));
const full = { ...extra,  r1a_bandeja: { report: r1a, sha256_salted: h("r1a_bandeja", r1a), items: items("r1a_bandeja", r1a) } };
fs.writeFileSync(path.join(root, "data/dist/build_answers.json"), JSON.stringify(full, null, 1));
fs.writeFileSync(path.join(root, "data/dist/build_answers.public.json"), JSON.stringify(Object.fromEntries(Object.entries(full).map(([k, v]) => [k, { sha256_salted: v.sha256_salted, aliases: [], items: v.items }])), null, 1));
fs.mkdirSync(path.join(root, "solutions"), { recursive: true });
fs.writeFileSync(path.join(root, "solutions/r1a_bandeja.json"), JSON.stringify({ decision: null, code: r1a }));
const sol = (id: string, code: string, extraProps: object = {}) => fs.writeFileSync(path.join(root, "solutions", `${id}.json`), JSON.stringify({ decision: null, code, ...extraProps }));
for (const [k, v] of Object.entries(expected)) sol(k.replace("r4c_veredicto", "r4c_veredicto"), v);
sol("r3c_modelo", String(answers.r3c_readmissions_base.value), { choices: Object.fromEntries(models.map((m) => [m.name, Object.fromEntries(Object.entries(m.slots ?? {}).map(([k, d]) => [k, d.options.find((o) => o.correct)!.id]))])) });
sol("r4d_codigo", String(answers.r4c_excluded.value));
sol("r5d_codigo", String(answers.r5c_top_center.value));
const chart = (type: string, title: string) => ({ type, title, axisZero: true, showN: true, sort: "desc", minN: true, palette: "accent", dualAxis: false, threeD: false });
const bad = (type: string) => ({ type, title: "Gráfico", axisZero: false, showN: false, sort: "none", minN: false, palette: "rainbow", dualAxis: false, threeD: false });
sol("r5b_dashboard", JSON.stringify({ charts: [bad("bar_center"), bad("line_month"), bad("bar_age")] }));
sol("r5c_critico", JSON.stringify({ charts: [chart("bar_center", "Un centro supera con claridad al resto en reingresos a 30 días"), { ...chart("line_month", "La tasa mensual de reingresos sube y baja alrededor del 10 %"), sort: "none" }, chart("bar_age", "Los mayores de 80 años reingresan más que cualquier otro grupo")] }));
console.log("build answers OK\n", r2b);
