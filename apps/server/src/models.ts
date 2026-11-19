import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { compile, type ModelDef, type SlotDef, type TestSpec } from "@codigo-alta/shared";

export interface ModelsBundle {
  models: ModelDef[];
  tests: TestSpec[];
}
const readYaml = (f: string) => YAML.parse(fs.readFileSync(f, "utf8"));
const refName = (v: string) => /ref\(['"](\w+)['"]\)/.exec(v)![1];

/** Load dbt-style models: *.sql + *.slots.yaml + schema.yml. `correct` flags stay server-side (see stripCorrect). */
export function loadModels(contentDir: string): ModelsBundle {
  const md = path.join(contentDir, "models");
  const models: ModelDef[] = [];
  for (const f of fs.readdirSync(md).filter((x) => x.endsWith(".sql"))) {
    const name = f.replace(/\.sql$/, "");
    const slotsFile = path.join(md, `${name}.slots.yaml`);
    const slots = fs.existsSync(slotsFile) ? (readYaml(slotsFile) as Record<string, SlotDef>) : undefined;
    models.push({ name, sql: fs.readFileSync(path.join(md, f), "utf8"), slots });
  }
  const schema = readYaml(path.join(md, "schema.yml")) as any;
  const tests: TestSpec[] = [];
  for (const m of schema.models ?? []) {
    for (const col of m.columns ?? []) {
      for (const t of col.tests ?? []) {
        if (typeof t === "string") tests.push({ kind: t, model: m.name, column: col.name } as TestSpec);
        else if (t.relationships) tests.push({ kind: "relationships", model: m.name, column: col.name, toModel: refName(t.relationships.to), toColumn: t.relationships.field });
        else if (t.accepted_values) tests.push({ kind: "accepted_values", model: m.name, column: col.name, values: t.accepted_values.values.map(String) });
      }
    }
    for (const t of m.tests ?? []) {
      if (t.expression_is_true) tests.push({ kind: "expression_is_true", model: m.name, expression: t.expression_is_true.expression, severity: t.expression_is_true.severity ?? "error" });
    }
  }
  return { models, tests };
}

/** The staging layer is no longer a level: stg_* models are served already resolved with their correct pieces, so R3C builds on clean data. */
export function withFixedStaging(b: ModelsBundle): ModelsBundle {
  return {
    tests: b.tests,
    models: b.models.map((m) => {
      if (!m.name.startsWith("stg_") || !m.slots) return m;
      const choice = Object.fromEntries(Object.entries(m.slots).map(([k, d]) => [k, d.options.find((o) => o.correct)!.id]));
      return { name: m.name, sql: compile(m, choice) };
    }),
  };
}

/** model -> slot -> id of the correct option (non-staging models only). Server only: Lumi uses it to say which piece is wrong. */
export function slotKeyOf(b: ModelsBundle): Record<string, Record<string, string>> {
  return Object.fromEntries(b.models.filter((m) => m.slots && !m.name.startsWith("stg_")).map((m) => [m.name, Object.fromEntries(Object.entries(m.slots!).map(([k, d]) => [k, d.options.find((o) => o.correct)?.id ?? ""]))]));
}

export function stripCorrect(b: ModelsBundle): ModelsBundle {
  return {
    tests: b.tests,
    models: b.models.map((m) => ({
      ...m,
      slots: m.slots && Object.fromEntries(Object.entries(m.slots).map(([k, d]) => [k, { ...d, options: d.options.map(({ correct: _c, ...o }) => o) }])),
    })),
  };
}
