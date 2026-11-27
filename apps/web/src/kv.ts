import { api } from "./api";

const local = {
  read: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  write: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
/**
 * Tool state (loader options, model choices, dashboard) lives on the server so any laptop of the team can continue.
 * The server wins (another laptop, or the facilitator moving the team to another level, may have changed it);
 * localStorage is only a fallback when the server cannot be reached.
 */
export const toolState = {
  async load(teamId: string, key: string): Promise<string | null> {
    const k = `ca_${key}_${teamId}`;
    try {
      const v = await api.kvGet(teamId, key);
      if (v) local.write(k, v); else local.del(k);
      return v;
    } catch { return local.read(k); }
  },
  save(teamId: string, key: string, value: string) {
    local.write(`ca_${key}_${teamId}`, value);
    api.kvSet(teamId, key, value).catch(() => {});
  },
};
