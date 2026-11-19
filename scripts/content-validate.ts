import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAnswers, loadContent, answerKey } from "../apps/server/src/content.js";
import { LANGS } from "@codigo-alta/shared";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict-gl");
const errors: string[] = [];
const warns: string[] = [];

let c;
try {
  c = loadContent(path.join(root, "content"));
} catch (e: any) {
  console.error("Content schema error:\n", e.issues ? JSON.stringify(e.issues, null, 1) : e.message);
  process.exit(1);
}
const answersFile = path.join(root, "data/dist/answers.public.json");
const buildFile = path.join(root, "data/dist/build_answers.public.json");
const answers = { ...(fs.existsSync(answersFile) ? loadAnswers(answersFile) : {}), ...(fs.existsSync(buildFile) ? loadAnswers(buildFile) : {}) };
if (!fs.existsSync(answersFile)) errors.push("falta data/dist/answers.public.json (ejecuta python data/run_all.py)");

const used = new Set<string>();
for (const r of c.rooms.values()) for (const l of r.locks) { used.add(l); if (!c.locks.has(l)) errors.push(`sala ${r.id}: candado inexistente ${l}`); }
const docIds = new Set(c.docs.map((x) => x.id));
const hasGl = (t: unknown) => typeof t === "object" && t !== null && "gl" in (t as object) && !!(t as any).gl;
const checkText = (where: string, t: unknown) => { if (!hasGl(t)) warns.push(`${where}: falta traducción gl`); };

for (const l of c.locks.values()) {
  if (!used.has(l.id)) errors.push(`${l.id}: no está en ninguna sala`);
  if (!c.rooms.has(l.room)) errors.push(`${l.id}: sala ${l.room} inexistente`);
  if (l.answer) {
    const k = answerKey(l.answer.source);
    if (!answers[k]) errors.push(`${l.id}: respuesta ${k} no existe en answers.public.json`);
  } else if (!l.validator && !l.decision) errors.push(`${l.id}: sin answer, validator ni decision`);
  for (const id of l.docs_needed) if (!docIds.has(id)) errors.push(`${l.id}: documento ${id} inexistente`);
  if (l.decision && !l.decision.options.some((o) => o.correct)) warns.push(`${l.id}: decisión sin opción correcta marcada`);
  checkText(`${l.id}.title`, l.title); checkText(`${l.id}.story`, l.story);
  l.hints.forEach((h, i) => checkText(`${l.id}.hints[${i}]`, h));
  l.decision?.options.forEach((o) => checkText(`${l.id}.${o.id}.label`, o.label));
  // the help ladder: every level with a right answer needs its solution (Lumi's last step), and the texts must stay short (spec: specs/ui/03-asistente-lumi.md)
  if (l.type !== "final" && !l.solution) errors.push(`${l.id}: falta la solución (solution) para el último paso de ayuda de Lumi`);
  if (l.solution) checkText(`${l.id}.solution`, l.solution);
  if (l.solution && l.answer && l.answer.normalize !== "report" && !JSON.stringify(l.solution).includes("{answer}")) warns.push(`${l.id}: la solución no usa {answer} (el valor real)`);
  const words = (t: unknown) => (typeof t === "string" ? t : (t as any)?.es ?? "").split(/\s+/).filter(Boolean).length;
  if (words(l.story) > 55) warns.push(`${l.id}: la misión tiene ${words(l.story)} palabras (máximo recomendado 55)`);
  if (l.answer_hint && words(l.answer_hint) > 35) warns.push(`${l.id}: «qué escribir» tiene ${words(l.answer_hint)} palabras (máximo 35)`);
  const sol = path.join(root, "solutions", `${l.id}.json`);
  if (!fs.existsSync(sol)) warns.push(`${l.id}: falta solutions/${l.id}.json (speedrun)`);
}
for (const l of c.locks.values()) {
  const g = c.guides.locks[l.id];
  if (!g) { errors.push(`${l.id}: falta guía explicativa en content/guides.yaml`); continue; }
  for (const k of g.terms) if (!c.glossary[k]) errors.push(`${l.id}: término de glosario inexistente ${k}`);
  checkText(`${l.id}.guide.goal`, g.goal); checkText(`${l.id}.guide.why`, g.why);
  g.steps.forEach((x, i) => checkText(`${l.id}.guide.steps[${i}]`, x));
  if (g.steps.length > 4) warns.push(`${l.id}: ${g.steps.length} pasos (máximo recomendado 4)`);
  g.steps.forEach((x, i) => { const n = (typeof x === "string" ? x : x.es).split(/\s+/).length; if (n > 30) warns.push(`${l.id}.guide.steps[${i}]: ${n} palabras (máximo 30)`); });
}
for (const r of c.rooms.values()) { if (!r.number || !r.stage || r.briefing.length === 0) warns.push(`${r.id}: falta número, etapa o resumen (briefing) de la sala`); r.briefing.forEach((b, i) => checkText(`${r.id}.briefing[${i}]`, b)); }
for (const r of c.rooms.values()) if (!c.guides.rooms[r.id]) errors.push(`${r.id}: falta contexto de sala en guides.yaml`);
for (const [k, g] of Object.entries(c.glossary)) { checkText(`glossary.${k}.term`, g.term); checkText(`glossary.${k}.def`, g.def); }
for (const r of c.rooms.values()) { checkText(`${r.id}.title`, r.title); checkText(`${r.id}.intro`, r.intro); }
for (const d of c.docs) { checkText(`${d.id}.title`, d.title); checkText(`${d.id}.body`, d.body); if (![...c.locks.values()].some((l) => l.docs_needed.includes(d.id))) errors.push(`${d.id}: ningún candado lo necesita (no aparecería nunca)`); }
const flat = (o: any, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const base = flat((c.i18n as any).es);
for (const lang of LANGS) { const have = new Set(flat((c.i18n as any)[lang])); base.filter((k) => !have.has(k)).forEach((k) => errors.push(`i18n/${lang}.json: falta ${k}`)); }

if (strict) errors.push(...warns.splice(0).filter((w) => w.includes("gl")));
warns.forEach((w) => console.warn("warn:", w));
if (errors.length) { errors.forEach((e) => console.error("ERROR:", e)); process.exit(1); }
console.log(`content OK: ${c.rooms.size} salas, ${c.locks.size} candados, ${c.docs.length} documentos, ${warns.length} avisos`);
