import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";

// loaded via require: vite/vitest do not recognise the node:sqlite builtin in ESM imports
const { DatabaseSync: Db } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

export function openDb(file: string): DatabaseSync {
  const db = new Db(file);
  db.exec(`
  PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, code TEXT UNIQUE, started_at INTEGER, paused_at INTEGER, config_json TEXT);
  CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY, session_id TEXT, alias TEXT, created_at INTEGER, meters_json TEXT, score INTEGER DEFAULT 0, state_json TEXT, UNIQUE(session_id, alias));
  CREATE TABLE IF NOT EXISTS lock_progress(team_id TEXT, lock_id TEXT, status TEXT, started_at INTEGER, completed_at INTEGER, attempts INTEGER DEFAULT 0, hints_used INTEGER DEFAULT 0, master_key_used INTEGER DEFAULT 0, points INTEGER DEFAULT 0, PRIMARY KEY(team_id, lock_id));
  CREATE TABLE IF NOT EXISTS decision_ledger(id INTEGER PRIMARY KEY AUTOINCREMENT, team_id TEXT, lock_id TEXT, decision_id TEXT, choice TEXT, effects_json TEXT, ts INTEGER);
  CREATE TABLE IF NOT EXISTS ai_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, team_id TEXT, character TEXT, lock_id TEXT, role TEXT, text TEXT, tokens INTEGER, ts INTEGER);
  CREATE TABLE IF NOT EXISTS events_log(id INTEGER PRIMARY KEY AUTOINCREMENT, team_id TEXT, type TEXT, payload_json TEXT, ts INTEGER);
  CREATE TABLE IF NOT EXISTS meter_history(team_id TEXT, ts INTEGER, meters_json TEXT);
  CREATE TABLE IF NOT EXISTS commission_turns(team_id TEXT, turn INTEGER, persona TEXT, qkey TEXT, question TEXT, answer TEXT, evidence_json TEXT, scores_json TEXT, vote INTEGER, ts INTEGER, PRIMARY KEY(team_id, turn));
  CREATE TABLE IF NOT EXISTS team_kv(team_id TEXT, k TEXT, v TEXT, ts INTEGER, PRIMARY KEY(team_id, k));
  `);
  return db;
}
