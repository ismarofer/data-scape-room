import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const dist = path.join(root, "apps/web/dist");
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const rel = (f: string) => path.relative(dist, f).split(path.sep).join("/");

describe.skipIf(!fs.existsSync(dist))("client bundle never contains answers", () => {
  const answers = JSON.parse(fs.readFileSync(path.join(root, "data/dist/answers.json"), "utf8"));
  const files = walk(dist).map(rel);
  // application code and small manifests only: the multi-MB data files and the DuckDB bundles are scanned by name, not by content
  const code = files.filter((f) => /\.(js|css|html)$/.test(f) && !f.startsWith("duckdb/"));
  const text = [...code, "data/raw/manifest.json"].filter((f) => files.includes(f)).map((f) => fs.readFileSync(path.join(dist, f), "utf8")).join("\n");

  it("ships no answer or solution files", () => {
    expect(files.some((f) => /answers|solutions/.test(path.basename(f)))).toBe(false);
  });
  it("has no answer values or hashes in code", () => {
    expect(text).not.toMatch(/[0-9a-f]{64}/);
    expect(text.toUpperCase()).not.toContain("ATLANTICO");
    for (const k of ["r1b_unique_encounters", "r2c_unique_patients", "r3c_readmissions_base", "r4c_excluded"]) expect(text).not.toContain(`"${answers[k].value}"`);
    expect(text).not.toContain("sha256_salted");
  });
  it("does not mark the correct slot options in the served models", async () => {
    const { loadModels, stripCorrect } = await import("./models.js");
    expect(JSON.stringify(stripCorrect(loadModels(path.join(root, "content"))))).not.toContain('"correct"');
  });
});
