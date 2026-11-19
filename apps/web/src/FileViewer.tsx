import { useEffect, useState } from "react";
import { FileInfo, InfoCard } from "./FileInfo";
import { Markdown } from "./Markdown";
import type { Lang, Project, TeamState } from "@codigo-alta/shared";

/** A file of the project explorer. `path` is what the explorer shows (data/raw/x.csv, models/x.sql, docs/x.md). */
export interface ProjectFile { path: string; kind: "csv" | "sql" | "md" }

export const RAW_FILES = [
  "patients.csv", "organizations.csv", "conditions.csv", "encounters_H1.csv", "encounters_H2.csv", "encounters_H2_reenvio.csv", "encounters_H3.csv", "encounters_H4.csv",
];
export const kindOf = (path: string): ProjectFile["kind"] => (path.endsWith(".csv") ? "csv" : path.endsWith(".sql") ? "sql" : "md");

const MAX_BYTES = 96 * 1024;
const MAX_LINES = 400;
const cache = new Map<string, { text: string; partial: boolean; size: number | null }>();

/** Reads only the start of a big CSV (Range request; the server may ignore it, then we cut the stream ourselves). */
async function head(url: string) {
  const hit = cache.get(url);
  if (hit) return hit;
  const res = await fetch(url, { headers: { Range: `bytes=0-${MAX_BYTES - 1}` } });
  if (!res.ok) throw new Error(String(res.status));
  const total = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "")?.[1];
  const reader = res.body!.getReader();
  const dec = new TextDecoder("utf-8");
  let text = "", got = 0, partial = res.status === 206;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value.length; text += dec.decode(value, { stream: true });
    if (got >= MAX_BYTES) { partial = true; reader.cancel().catch(() => {}); break; }
  }
  const out = { text, partial, size: total ? Number(total) : res.headers.get("content-length") && res.status === 200 ? Number(res.headers.get("content-length")) : null };
  cache.set(url, out);
  return out;
}

const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Code({ text, note }: { text: string; note?: string }) {
  const lines = text.split(/\r?\n/);
  return (
    <div className="codeview" tabIndex={0}>
      <pre>{lines.map((l, i) => <div key={i} className="ln"><span className="no">{i + 1}</span><span className="tx">{l || " "}</span></div>)}</pre>
      {note && <p className="viewnote">{note}</p>}
    </div>
  );
}

function CsvView({ name, lang }: { name: string; lang: Lang }) {
  const [d, setD] = useState<{ text: string; partial: boolean; size: number | null } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { setD(null); setErr(false); head(`/data/raw/${name}`).then(setD).catch(() => setErr(true)); }, [name]);
  if (err) return <p className="err viewpad">{lang === "gl" ? "Non se puido abrir o ficheiro." : "No se ha podido abrir el fichero."}</p>;
  if (!d) return <p className="viewpad">…</p>;
  let lines = d.text.split(/\r?\n/);
  const cut = d.partial || lines.length > MAX_LINES;
  if (d.partial) lines = lines.slice(0, -1); // the last line may be cut in half
  lines = lines.slice(0, MAX_LINES);
  const es = lang === "es";
  return (
    <>
    <div className="fileinfo-wrap"><FileInfo name={name} lang={lang} /></div>
    <Code
      text={lines.join("\n")}
      note={cut ? (es ? `Vista previa: primeras ${lines.length} líneas${d.size ? ` de un fichero de ${kb(d.size)}` : ""}. Para trabajar con todo el fichero, usad el cargador del nivel.` : `Vista previa: primeiras ${lines.length} liñas${d.size ? ` dun ficheiro de ${kb(d.size)}` : ""}. Para traballar con todo o ficheiro, usade o cargador do nivel.`) : undefined}
    />
    </>
  );
}

/** The model as a reader sees it: no template syntax, table names instead of ref()/source(), holes shown by name. */
export function readableSql(sql: string, slots: Record<string, any> | undefined, lang: Lang): string {
  const tx = (t: any) => (typeof t === "string" ? t : t?.[lang] ?? t?.es ?? "");
  return sql
    .replace(/\{\{\s*config\([^}]*\)\s*\}\}\n?/g, "")
    .replace(/\{\{\s*ref\(\s*'(\w+)'\s*\)\s*\}\}/g, "$1")
    .replace(/\{\{\s*source\(\s*'(\w+)'\s*,\s*'(\w+)'\s*\)\s*\}\}/g, "$1.$2")
    .replace(/\{\{\s*slot:(\w+)(?::\w+)?\s*\}\}/g, (_m, id) => `▾ ${tx(slots?.[id]?.label) || id}`)
    .trimEnd();
}

export function FileViewer({ path, lang, project, docs }: { path: string; lang: Lang; project: Project | null; docs: TeamState["docs"] }) {
  const kind = kindOf(path);
  if (kind === "csv") return <CsvView name={path.split("/").pop()!} lang={lang} />;
  if (kind === "sql") {
    const m = project?.models.find((x) => `${x.name}.sql` === path.split("/").pop());
    if (!m) return <p className="viewpad">…</p>;
    const es = lang === "es";
    const schema = m.name.startsWith("stg_") ? "staging" : "marts";
    return (
      <>
        <div className="fileinfo-wrap"><InfoCard k={`db:${schema}.${m.name}`} lang={lang} note={es ? `Este fichero es la «receta» que crea la tabla ${m.name}.` : `Este ficheiro é a «receita» que crea a táboa ${m.name}.`} /></div>
        <Code text={readableSql(m.sql, m.slots, lang)} note={m.slots ? (es ? "Los huecos «▾ …» los rellenáis vosotros en el nivel (constructor del modelo)." : "Os ocos «▾ …» enchédelos vós no nivel (construtor do modelo).") : undefined} />
      </>
    );
  }
  const d = docs.find((x) => x.path === path);
  if (!d) return <p className="viewpad">…</p>;
  return (
    <article className="mdview">
      <h1>{d.title}</h1>
      <Markdown source={d.body} />
    </article>
  );
}
