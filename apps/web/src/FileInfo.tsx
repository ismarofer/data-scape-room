import { useEffect, useState } from "react";
import type { Lang } from "@codigo-alta/shared";

/** One entry of the catalogue (content/files.yaml + content/tables.yaml): what a file or table is and what its columns mean. */
export interface FileInfoEntry { what: string; label?: string; cols: { name: string; text: string }[] }
type Catalog = Record<string, FileInfoEntry>;
const cache = new Map<string, Promise<Catalog>>();
const load = (lang: Lang) => {
  if (!cache.has(lang)) cache.set(lang, fetch(`/api/files?lang=${lang}`).then((r) => r.json()).catch(() => { cache.delete(lang); return {}; }));
  return cache.get(lang)!;
};
/** Finds the entry of a key: "patients.csv", "db:raw.patients" or a prefix entry such as "db:raw.encounters_h*". */
export function lookup(all: Catalog, key: string): FileInfoEntry | undefined {
  if (all[key]) return all[key];
  const pre = Object.keys(all).filter((k) => k.endsWith("*") && key.startsWith(k.slice(0, -1))).sort((a, b) => b.length - a.length)[0];
  return pre ? all[pre] : undefined;
}
export function useCatalog(lang: Lang): Catalog {
  const [all, setAll] = useState<Catalog>({});
  useEffect(() => { let on = true; load(lang).then((d) => on && setAll(d)); return () => { on = false; }; }, [lang]);
  return all;
}

/**
 * «¿Qué es esto?»: the same card for every data file, database table and model of the project, so help always looks the same.
 * `k` is "patients.csv" for a file or "db:schema.table" for a table. `open` shows the column list unfolded.
 */
export function InfoCard({ k, lang, open = false, note }: { k: string; lang: Lang; open?: boolean; note?: string }) {
  const all = useCatalog(lang);
  const e = lookup(all, k);
  const gl = lang === "gl";
  if (!e) return null;
  return (
    <div className="fileinfo" data-tour="infocard">
      <p className="fi-what"><span className="fi-tag">ℹ️ {gl ? "Que é isto?" : "¿Qué es esto?"}</span> {e.label && <b>{e.label}. </b>}{e.what}</p>
      {note && <p className="fi-note">{note}</p>}
      {e.cols.length > 0 && (
        <details open={open}>
          <summary>{gl ? "Que significa cada columna" : "Qué significa cada columna"}</summary>
          <dl>{e.cols.map((c) => <div key={c.name}><dt><code>{c.name}</code></dt><dd>{c.text}</dd></div>)}</dl>
        </details>
      )}
    </div>
  );
}
/** Kept for the loader and the file tabs: the card of a data file. */
export function FileInfo({ name, lang, open }: { name: string; lang: Lang; open?: boolean }) {
  return <InfoCard k={name} lang={lang} open={open} />;
}
