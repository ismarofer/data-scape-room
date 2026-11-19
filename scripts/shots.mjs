// Visual check: walks the first steps in Edge and saves screenshots to the scratchpad (usage: node scripts/shots.mjs <outDir> [baseUrl])
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:3600";
fs.mkdirSync(out, { recursive: true });
const sizes = [{ w: 1366, h: 768, n: "hd" }, { w: 1024, h: 700, n: "small" }];
const b = await chromium.launch({ channel: "msedge" });
for (const sz of sizes) {
  const p = await b.newPage({ viewport: { width: sz.w, height: sz.h } });
  await p.goto(base);
  await p.screenshot({ path: path.join(out, `${sz.n}-1-join.png`) });
  await p.getByLabel(/Alias del equipo/).fill("Equipo " + sz.n + Date.now().toString(36));
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(out, `${sz.n}-2-intro.png`) });
  const next = p.getByRole("button", { name: /Siguiente/ });
  while (await next.count()) { await next.click(); }
  await p.getByRole("button", { name: /Empezamos/ }).click();
  await p.screenshot({ path: path.join(out, `${sz.n}-3-tutorial.png`) });
  await p.getByLabel("Vuestra respuesta", { exact: true }).fill("atlantico");
  await p.getByRole("button", { name: "Probar" }).click();
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: /encounters_H1/ }).click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(out, `${sz.n}-4-wizard.png`), fullPage: true });
  await p.close();
}
await b.close();
console.log("done");
