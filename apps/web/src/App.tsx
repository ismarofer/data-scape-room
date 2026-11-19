import { useCallback, useEffect, useState } from "react";
import { LANGS, type Lang } from "@codigo-alta/shared";
import { api, ApiError } from "./api";
import { Workbench } from "./Workbench";
import { ThemeToggle } from "./ThemeToggle";

type Dict = Record<string, any>;
const get = (d: Dict, path: string): string => path.split(".").reduce((o: any, k) => o?.[k], d) ?? path;
const store = {
  read: (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } },
  write: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export function App() {
  const [lang, setLang] = useState<Lang>((store.read("ca_lang") as Lang) || "es");
  const [dict, setDict] = useState<Dict>({});
  const [teamId, setTeamId] = useState(store.read("ca_team"));
  useEffect(() => { api.i18n(lang).then(setDict).catch(() => {}); store.write("ca_lang", lang); document.documentElement.lang = lang; }, [lang]);
  const t = useCallback((k: string) => get(dict, k), [dict]);
  const exit = useCallback(() => { store.write("ca_team", ""); setTeamId(""); }, []);
  if (teamId) return <Workbench teamId={teamId} lang={lang} setLang={setLang} t={t} dict={dict} onExit={exit} />;
  return (
    <>
      <header className="top">
        <strong>{t("app.title")}</strong>
        <span><ThemeToggle lang={lang} /> <label className="lang" style={{ display: "inline" }}>
          <span className="sr">Idioma</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>{LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</select>
        </label></span>
      </header>
      <main><Join t={t} onJoined={(id) => { store.write("ca_team", id); setTeamId(id); }} /></main>
      <footer>{t("app.disclaimer")}</footer>
    </>
  );
}

function Join({ t, onJoined }: { t: (k: string) => string; onJoined: (id: string) => void }) {
  const [f, setF] = useState({ teamAlias: "" });
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { onJoined((await api.join(f)).teamId); } catch (x) { setErr((x as ApiError).message); }
  };
  return (
    <form className="card join" onSubmit={submit}>
      <h1>{t("app.title")}</h1>
      <p className="hint-small">{t("join.help")}</p>
      <label>{t("join.team")}<input value={f.teamAlias} onChange={(e) => setF({ ...f, teamAlias: e.target.value })} required maxLength={24} /></label>
      <button type="submit">{t("join.go")}</button>
      <p role="alert" className="err">{err}</p>
    </form>
  );
}
