import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { Glossary, GuidesFile, Lock, Room, SessionConfig, ProjectDoc, type LockT, type RoomT, type SessionConfigT } from "@codigo-alta/shared";
import { z } from "zod";

export interface Content {
  session: SessionConfigT;
  rooms: Map<string, RoomT>;
  locks: Map<string, LockT>;
  docs: z.infer<typeof ProjectDoc>[];
  blocked: string[];
  order: string[];
  i18n: Record<string, unknown>;
  glossary: z.infer<typeof Glossary>;
  guides: z.infer<typeof GuidesFile>;
}
const readYaml = (f: string) => YAML.parse(fs.readFileSync(f, "utf8"));

export function loadContent(dir: string): Content {
  const session = SessionConfig.parse(readYaml(path.join(dir, "session.yaml")));
  const rooms = new Map<string, RoomT>();
  const locks = new Map<string, LockT>();
  for (const f of fs.readdirSync(path.join(dir, "rooms"))) {
    const r = Room.parse(readYaml(path.join(dir, "rooms", f)));
    rooms.set(r.id, r);
  }
  for (const f of fs.readdirSync(path.join(dir, "locks"))) {
    const l = Lock.parse(readYaml(path.join(dir, "locks", f)));
    locks.set(l.id, l);
  }
  const docs = z.array(ProjectDoc).parse(readYaml(path.join(dir, "docs.yaml")));
  const blocked: string[] = readYaml(path.join(dir, "moderation.yaml")).blocked ?? [];
  const order = session.rooms.flatMap((r) => rooms.get(r)?.locks ?? []);
  const i18n: Record<string, unknown> = {};
  for (const l of ["es", "gl"]) i18n[l] = JSON.parse(fs.readFileSync(path.join(dir, "i18n", `${l}.json`), "utf8"));
  const glossary = Glossary.parse(readYaml(path.join(dir, "glossary.yaml")));
  const guides = GuidesFile.parse(readYaml(path.join(dir, "guides.yaml")));
  return { session, rooms, locks, docs, blocked, order, i18n, glossary, guides };
}

export interface AnswerEntry {
  sha256_salted: string;
  aliases: string[];
  /** salted hash of each CORRECT item of a structured report (see itemizeReport); lets the server say WHICH items are wrong */
  items?: string[];
}
export function loadAnswers(file: string): Record<string, AnswerEntry> {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
export const answerKey = (source: string) => source.split("#")[1] ?? source;

/** Minimal .env loader (server only; values are never logged). Existing process env wins. */
export function loadEnv(root: string) {
  const f = path.join(root, ".env");
  if (!fs.existsSync(f)) return;
  for (const raw of fs.readFileSync(f, "utf8").split(String.fromCharCode(10))) {
    const line = raw.trim();
    const eq = line.indexOf("=");
    if (eq < 1 || line.startsWith("#")) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
