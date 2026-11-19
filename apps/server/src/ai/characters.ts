import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { tr, type Lang, type LTextT } from "@codigo-alta/shared";
import { plain } from "./moderation.js";

export interface Fact { id: string; text: LTextT; reveal_all: string[][] }
export interface Character {
  id: string; name: string; role: LTextT; persona: LTextT; max_questions: number; greeting: LTextT;
  facts: Fact[]; fallback: LTextT[]; off_topic: LTextT;
}
export function loadCharacters(contentDir: string): Record<string, Character> {
  const dir = path.join(contentDir, "characters");
  return Object.fromEntries(fs.readdirSync(dir).map((f) => { const c = YAML.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Character; return [c.id, c]; }));
}
export function loadPrompts(contentDir: string): Record<string, string> {
  const dir = path.join(contentDir, "prompts");
  return Object.fromEntries(fs.readdirSync(dir).map((f) => [f.replace(/\.md$/, ""), fs.readFileSync(path.join(dir, f), "utf8")]));
}
export const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? `{${k}}`);

/** Deterministic reveal condition (SPEC 4 / 7 R4B): every keyword group needs at least one hit in the player's message. */
export function revealedBy(c: Character, message: string): string[] {
  const m = plain(message);
  return c.facts.filter((f) => f.reveal_all.every((group) => group.some((k) => m.includes(plain(k))))).map((f) => f.id);
}

export function scriptedNpc(c: Character, message: string, turn: number, already: Set<string>, lang: Lang): { text: string; revealed: string[] } {
  const hit = revealedBy(c, message);
  const fresh = hit.filter((id) => !already.has(id));
  if (fresh.length) return { text: fresh.map((id) => tr(c.facts.find((f) => f.id === id)!.text, lang)).join(" "), revealed: fresh };
  if (hit.length) return { text: lang === "gl" ? "Iso xa vos o din antes. Preguntade por outra cousa." : "Eso ya os lo he dicho antes. Preguntad por otra cosa.", revealed: [] };
  if (plain(message).replace(/[^a-z]/g, "").length < 6) return { text: tr(c.off_topic, lang), revealed: [] };
  return { text: tr(c.fallback[turn % c.fallback.length], lang), revealed: [] };
}
