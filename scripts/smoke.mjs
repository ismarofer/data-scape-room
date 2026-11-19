// Smoke test against a running server: two devices in one team, WS live updates, solve via solutions/.
import fs from "node:fs";
const base = process.env.BASE ?? "http://localhost:3000";
const j = async (m, u, b, h = {}) => (await fetch(base + u, { method: m, headers: { "content-type": "application/json", ...h }, body: b ? JSON.stringify(b) : undefined })).json();
const a = await j("POST", "/api/teams/join", { teamAlias: "Mareas" + Date.now().toString(36) });
let got = 0; const ws = new WebSocket(`${base.replace("http", "ws")}/ws?teamId=${a.teamId}`); ws.onmessage = (e) => { if (JSON.parse(e.data).type === "state_update") got++; };
await new Promise((r) => (ws.onopen = r));
for (const lock of ["p0_tutorial", "r1b_reenvio"]) {
  const sol = JSON.parse(fs.readFileSync(`solutions/${lock}.json`, "utf8"));
  if (sol.decision) await j("POST", "/api/decisions", { teamId: a.teamId, lockId: lock, optionId: sol.decision });
  const r = await j("POST", "/api/locks/submit", { teamId: a.teamId, code: sol.code });
  console.log(lock, r);
}
const st = await (await fetch(`${base}/api/teams/${a.teamId}/state`)).json();
await new Promise((r) => setTimeout(r, 200));
console.log({ score: st.score, meters: st.meters, current: st.currentLockId, wsUpdates: got });
ws.close(); process.exit(st.currentLockId === null && got > 0 ? 0 : 1);
