import { analyze, closure, consolidateEncounters, decode, FILE_SPECS, loadRaw, rawTableName, runProject, schemaOf, type Project } from "@codigo-alta/shared";
import { fetchRaw, getEngine } from "./duck";
import { toolState } from "./kv";

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

const restoring = new Map<string, Promise<void>>();
/**
 * After a page reload the in-browser database is empty. Rebuild what the team had: raw.* from the loader options and
 * staging.* / marts.* from the pieces chosen in the model builder (only the models whose pieces are all chosen).
 * Called once when the game screen opens, so the Database panel shows the same tables as before the reload.
 */
export function restoreWork(teamId: string, project: Project): Promise<void> {
  if (!restoring.has(teamId)) restoring.set(teamId, (async () => {
    if (!(await restoreRaw(teamId))) return;
    const eng = await getEngine();
    const has = async (t: string) => { try { await eng.query(`select 1 from ${t} limit 1`); return true; } catch { return false; } };
    const choices: Record<string, Record<string, string>> = JSON.parse((await toolState.load(teamId, "mb")) ?? "{}");
    const ready = (n: string) => { const m = project.models.find((x) => x.name === n); return !!m && Object.keys(m.slots ?? {}).every((s) => choices[n]?.[s]); };
    const targets = project.models.map((m) => m.name).filter((n) => closure(project.models, [n]).every(ready));
    if (!targets.length) return;
    let missing = false;
    for (const n of targets) if (!(await has(`${schemaOf(n)}.${n}`))) missing = true;
    if (missing) await runProject(eng, project, choices, { only: closure(project.models, targets) });
  })().catch(() => { restoring.delete(teamId); }));
  return restoring.get(teamId)!;
}
