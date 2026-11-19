import type { Lang, Project, TeamState } from "@codigo-alta/shared";

export class ApiError extends Error {
  constructor(public code: string, message: string, public extra: Record<string, any> = {}) {
    super(message);
  }
}
async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? "error", json.message ?? "Error", json);
  return json as T;
}
export const api = {
  join: (b: { teamAlias: string }) => call<{ teamId: string }>("POST", "/api/teams/join", b),
  kvGet: async (teamId: string, key: string): Promise<string | null> => (await call<{ value: string | null }>("GET", `/api/teams/${teamId}/kv/${key}`)).value,
  kvSet: (teamId: string, key: string, value: string) => call("PUT", `/api/teams/${teamId}/kv/${key}`, { value }),
  state: (teamId: string, lang: Lang) => call<TeamState>("GET", `/api/teams/${teamId}/state?lang=${lang}`),
  submit: (teamId: string, code: string, lang?: Lang) => call<{ ok: boolean; feedback?: string; badColumns?: { col: string; kind: string }[]; badItems?: { id: string }[]; missingCount?: number }>("POST", "/api/locks/submit", { teamId, code, lang }),
  hint: (teamId: string, level: number) => call<{ level: number }>("POST", "/api/locks/hint", { teamId, level }),
  lumiHelp: (teamId: string, level: number, lang: Lang) => call<{ level: number; penalty: number; text: string }>("POST", "/api/ai/lumi/help", { teamId, level, lang }),
  lumiHistory: (teamId: string) => call<{ messages: { role: "user" | "assistant"; text: string; lockId: string | null }[] }>("GET", `/api/ai/lumi/history/${teamId}`),
  decide: (teamId: string, lockId: string, optionId: string) => call("POST", "/api/decisions", { teamId, lockId, optionId }),
  commission: (teamId: string, lang: Lang) => call<unknown>("GET", `/api/commission/${teamId}?lang=${lang}`),
  commissionAnswer: (teamId: string, answer: string, evidenceIds: string[], lang: Lang) => call<unknown>("POST", "/api/commission/answer", { teamId, answer, evidenceIds, lang }),
  skipBonus: (teamId: string) => call("POST", "/api/locks/skip-bonus", { teamId }),
  models: () => call<Project>("GET", "/api/models"),
  i18n: (lang: Lang) => call<Record<string, any>>("GET", `/api/i18n/${lang}`),
};

export function connectWs(teamId: string, onMsg: (type: string) => void): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 500;
  const open = () => {
    if (closed) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws?teamId=${teamId}`);
    ws.onopen = () => {
      retry = 500;
      onMsg("reconnected");
    };
    ws.onmessage = (e) => {
      try {
        onMsg(JSON.parse(e.data).type);
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      if (!closed) setTimeout(open, (retry = Math.min(retry * 2, 8000)));
    };
  };
  open();
  return () => {
    closed = true;
    ws?.close();
  };
}
