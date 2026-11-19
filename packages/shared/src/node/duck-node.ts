// Node harness: DuckDB-WASM (blocking build) behind the SqlEngine interface. Used by tests and answer generation only.
import { createRequire } from "node:module";
import path from "node:path";
import { plainValue, type SqlEngine } from "../duck";

const require_ = createRequire(import.meta.url);
export interface NodeEngine extends SqlEngine { registerText(name: string, text: string): void; registerBuffer(name: string, bytes: Uint8Array): void; close(): void }

export async function createNodeEngine(): Promise<NodeEngine> {
  const m = require_("@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs");
  const dist = path.dirname(require_.resolve("@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs"));
  const bundles = {
    mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: path.join(dist, "duckdb-node-mvp.worker.cjs") },
    eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: path.join(dist, "duckdb-node-eh.worker.cjs") },
  };
  const db = await m.createDuckDB(bundles, new m.VoidLogger(), m.NODE_RUNTIME);
  await db.instantiate(() => {});
  const conn = db.connect();
  return {
    async query(sql: string) {
      const t = conn.query(sql);
      return t.toArray().map((r: any) => {
        const o: Record<string, any> = {};
        for (const k of Object.keys(r.toJSON())) { const v = r[k]; o[k] = plainValue(v); }
        return o;
      });
    },
    registerText(name: string, text: string) { db.registerFileBuffer(name, new TextEncoder().encode(text)); },
    registerBuffer(name: string, bytes: Uint8Array) { db.registerFileBuffer(name, bytes); },
    close() { conn.close(); },
  };
}
