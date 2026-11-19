import { analyze, consolidateEncounters, decode, FILE_SPECS, loadRaw, rawTableName } from "@codigo-alta/shared";
import { fetchRaw, getEngine } from "./duck";
import { toolState } from "./kv";

const store = {
  read: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
};

/** Rebuild raw.* after a reload from the options the team saved in the wizard (actions are stored, data is not). */
export async function restoreRaw(teamId: string): Promise<boolean> {
  const eng = await getEngine();
  try {
    await eng.query("select 1 from raw.encounters limit 1");
    return true;
  } catch {
    /* rebuild below */
  }
  const saved = JSON.parse((await toolState.load(teamId, "wiz")) ?? "{}");
  if (!FILE_SPECS.every((s) => saved[s.name])) return false;
  for (const s of FILE_SPECS) await loadRaw(eng, rawTableName(s.name), analyze(decode(await fetchRaw(s.name), saved[s.name].encoding), saved[s.name], s));
  await consolidateEncounters(eng, FILE_SPECS.filter((s) => s.name.startsWith("encounters")).map((s) => rawTableName(s.name)));
  return true;
}
