import { api } from "./api";

const local = {
  read: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  write: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
/** Tool state (loader options, model choices, dashboard) lives on the server so any laptop of the team can continue; localStorage is just a cache. */
export const toolState = {
  async load(teamId: string, key: string): Promise<string | null> {
    const l = local.read(`ca_${key}_${teamId}`);
    if (l) return l;
    try { const v = await api.kvGet(teamId, key); if (v) local.write(`ca_${key}_${teamId}`, v); return v; } catch { return null; }
  },
  save(teamId: string, key: string, value: string) {
    local.write(`ca_${key}_${teamId}`, value);
    api.kvSet(teamId, key, value).catch(() => {});
  },
};
