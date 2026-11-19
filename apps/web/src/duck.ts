import * as duckdb from "@duckdb/duckdb-wasm";
import { plainValue, type TextEngine } from "@codigo-alta/shared";

// Self-hosted bundles (copied to /duckdb by scripts/sync-public.mjs): no CDN at runtime.
const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: "/duckdb/duckdb-mvp.wasm", mainWorker: "/duckdb/duckdb-browser-mvp.worker.js" },
  eh: { mainModule: "/duckdb/duckdb-eh.wasm", mainWorker: "/duckdb/duckdb-browser-eh.worker.js" },
};
let enginePromise: Promise<TextEngine> | null = null;

/** True once DuckDB has been started by some tool (the inspector never starts it by itself: it is heavy). */
export const engineStarted = () => enginePromise !== null;

export function getEngine(): Promise<TextEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const bundle = await duckdb.selectBundle(BUNDLES);
      const worker = new Worker(bundle.mainWorker!);
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      const conn = await db.connect();
      const engine: TextEngine = {
        async query(sql: string) {
          const t = await conn.query(sql);
          return t.toArray().map((r: any) => {
            const o: Record<string, any> = {};
            const j = r.toJSON();
            for (const k of Object.keys(j)) o[k] = plainValue(r[k]);
            return o;
          });
        },
        async registerText(name: string, text: string) {
          await db.registerFileText(name, text);
        },
        async registerBuffer(name: string, bytes: Uint8Array) {
          await db.registerFileBuffer(name, bytes);
        },
      };
      return engine;
    })();
    enginePromise.catch(() => (enginePromise = null));
  }
  return enginePromise;
}

const cache = new Map<string, Uint8Array>();
export async function fetchRaw(name: string): Promise<Uint8Array> {
  if (!cache.has(name)) {
    const r = await fetch(`/data/raw/${name}`);
    if (!r.ok) throw new Error(`No se pudo leer ${name}`);
    cache.set(name, new Uint8Array(await r.arrayBuffer()));
  }
  return cache.get(name)!;
}

/** Canonical marts (identical for every team): views over the static Parquet files, schema `canon`. */
let canon: Promise<void> | null = null;
export function ensureCanon(): Promise<void> {
  if (!canon) {
    canon = (async () => {
      const eng = await getEngine();
      await eng.query("create schema if not exists canon");
      for (const f of ["fct_admission_clean", "anomalies"]) {
        await eng.registerText(`${f}.csv`, await (await fetch(`/data/canon/${f}.csv`)).text());
        await eng.query(`create or replace table canon.${f} as select * from read_csv('${f}.csv', header=true, delim=',')`);
      }
    })();
    canon.catch(() => (canon = null));
  }
  return canon;
}
