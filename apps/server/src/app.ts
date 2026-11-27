import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import YAML from "yaml";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fstatic from "@fastify/static";
import { z } from "zod";
import { DecisionReq, HintReq, JoinReq, LANGS, SubmitReq, tr, type Lang } from "@codigo-alta/shared";
import { Engine, GameError } from "./engine.js";
import type { Content } from "./content.js";
import { stripCorrect, withFixedStaging, type ModelsBundle } from "./models.js";
import type { AiService } from "./ai/service.js";
import type { Commission } from "./commission.js";

export interface AppOpts {
  engine: Engine;
  content: Content;
  pin: string;
  webDist?: string;
  models?: ModelsBundle;
  claims?: { id: string; text: unknown }[];
  ai?: AiService;
  commission?: Commission;
  contentDir?: string;
}

export function buildApp(o: AppOpts) {
  const app = Fastify({ logger: false });
  const sockets = new Map<string, Set<any>>();
  const send = (teamId: string, type: string, payload?: unknown) => {
    for (const s of sockets.get(teamId) ?? []) {
      try {
        s.send(JSON.stringify({ type, payload }));
      } catch {
        /* closed */
      }
    }
  };
  const prevNotify = o.engine["o"].onChange;
  o.engine["o"].onChange = (t, ty, p) => {
    prevNotify?.(t, ty, p);
    send(t, ty, p);
  };

  app.register(cors, { origin: true });
  app.register(rateLimit, { max: 600, timeWindow: "1 minute" });
  app.register(websocket);
  app.addHook("onSend", async (_req, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("content-security-policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval'");
  });
  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof GameError) return reply.status(err.status).send({ error: err.code, message: err.message, ...err.extra });
    if (err instanceof z.ZodError) return reply.status(400).send({ error: "bad_request", message: "Petición no válida", issues: err.issues.map((i) => i.message) });
    return reply.status(err.statusCode ?? 500).send({ error: "server_error", message: "Algo ha fallado" });
  });

  const lang = (q: any): Lang => (LANGS.includes(q?.lang) ? q.lang : "es");
  const facilitator = (req: any) => {
    if (req.headers["x-facilitator-pin"] !== o.pin) throw new GameError(401, "bad_pin", "PIN incorrecto");
  };

  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/i18n/:lang", async (req: any) => o.content.i18n[lang(req.params)] ?? {});

  app.get("/api/protocol", async () => YAML.parse(fs.readFileSync(path.join(o.contentDir ?? "content", "protocol.yaml"), "utf8")));
  app.get("/api/files", async (req: any) => {
    const raw = YAML.parse(fs.readFileSync(path.join(o.contentDir ?? "content", "files.yaml"), "utf8")) as Record<string, any>;
    const L: Lang = lang(req.query);
    const one = (e: any, prefix = "") => ({ what: prefix + (e.what[L] ?? e.what.es), cols: (e.cols ?? []).map((c: any) => ({ name: c.name, text: c[L] ?? c.es })) });
    const out: Record<string, ReturnType<typeof one>> = {};
    for (const f of ["patients.csv", "organizations.csv", "conditions.csv", "encounters_H2_reenvio.csv"]) out[f] = one(raw[f]);
    for (const h of ["H1", "H2", "H3", "H4"]) out[`encounters_${h}.csv`] = one(raw.encounters, L === "gl" ? `(Envío do hospital ${h}.) ` : `(Envío del hospital ${h}.) `);
    // database tables: the same card, keyed "db:schema.table" (a key ending in * matches by prefix)
    const tf = path.join(o.contentDir ?? "content", "tables.yaml");
    if (fs.existsSync(tf)) {
      const tables = YAML.parse(fs.readFileSync(tf, "utf8")) as Record<string, any>;
      for (const [k, e] of Object.entries(tables)) out[`db:${k}`] = { ...one(e), label: e.label?.[L] ?? e.label?.es } as any;
    }
    return out;
  });
  app.get("/api/models", async () => (o.models ? stripCorrect(withFixedStaging(o.models)) : { models: [], tests: [] }));
  app.get("/api/verify/:lockId", async (req: any) => {
    const l = o.content.locks.get(req.params.lockId);
    if (!l || l.validator?.type !== "verify_claims") throw new GameError(404, "no_verify", "No existe");
    return { claims: o.claims ?? [] };
  });
  const L = z.enum(LANGS).default("es");
  const needAi = () => { if (!o.ai) throw new GameError(503, "no_ai", "IA no disponible"); return o.ai; };
  const Work = z.object({ tables: z.array(z.object({ name: z.string().max(80), rows: z.number() })).max(30).optional(), lastQuery: z.object({ sql: z.string().max(800), result: z.string().max(500) }).nullable().optional(), draft: z.string().max(6000).optional(), draftText: z.string().max(1500).optional(), view: z.string().max(200).optional() });
  app.post("/api/ai/lumi", async (req) => { const b = z.object({ teamId: z.string(), message: z.string().max(2000), lang: L, work: Work.optional() }).parse(req.body); return needAi().lumi(b.teamId, b.message, b.lang, b.work); });
  app.post("/api/ai/lumi/help", async (req) => { const b = z.object({ teamId: z.string(), level: z.number().int().min(1).max(4), lang: L }).parse(req.body); return needAi().helpStep(b.teamId, b.level, b.lang); });
  app.get("/api/ai/lumi/history/:teamId", async (req: any) => ({ messages: o.engine.chatLog(req.params.teamId, "lumi", 40) }));
  // the interviews, to review them in the solved level (the team's own conversation only)
  app.get("/api/ai/npc/history/:teamId/:npcId", async (req: any) => ({ messages: ["noa", "brais"].includes(req.params.npcId) ? o.engine.chatLog(req.params.teamId, req.params.npcId, 40) : [] }));
  app.post("/api/ai/npc/:npcId", async (req: any) => { const b = z.object({ teamId: z.string(), message: z.string().max(2000), lang: L }).parse(req.body); return needAi().npc(b.teamId, req.params.npcId, b.message, b.lang); });
  app.get("/api/ai/greeting/:npcId", async (req: any) => ({ text: needAi().greeting(req.params.npcId, lang(req.query)) }));
  app.post("/api/ai/critic", async (req) => { const b = z.object({ teamId: z.string(), spec: z.object({ charts: z.array(z.any()).max(8) }), lang: L }).parse(req.body); return needAi().critic(b.teamId, b.spec as any, b.lang); });
  app.post("/api/ai/ada", async (req) => { const b = z.object({ teamId: z.string(), request: z.string().max(2000), lang: L }).parse(req.body); return needAi().ada(b.teamId, b.request, b.lang); });
  app.post("/api/teams/join", async (req) => o.engine.join(JoinReq.parse(req.body)));
  app.get("/api/teams/:id/state", async (req: any) => o.engine.state(req.params.id, lang(req.query)));
  app.get("/api/teams/:id/kv/:key", async (req: any) => ({ value: o.engine.kvGet(req.params.id, req.params.key) }));
  app.put("/api/teams/:id/kv/:key", { bodyLimit: 100_000 }, async (req: any) => { o.engine.kvSet(req.params.id, req.params.key, String((req.body as any)?.value ?? "")); return { ok: true }; });
  app.post("/api/locks/submit", async (req) => {
    const b = SubmitReq.parse(req.body);
    return o.engine.submit(b.teamId, b.code, b.lang ?? "es");
  });
  app.post("/api/locks/hint", async (req) => {
    const b = HintReq.parse(req.body);
    return o.engine.hint(b.teamId, b.level, lang(req.query));
  });
  app.post("/api/decisions", async (req) => {
    const b = DecisionReq.parse(req.body);
    return o.engine.decide(b.teamId, b.lockId, b.optionId);
  });
  // facilitator
  app.post("/api/locks/master-key", async (req) => {
    facilitator(req);
    return o.engine.masterKey(z.object({ teamId: z.string() }).parse(req.body).teamId);
  });
  // testing shortcut: put a team (or a new test team) at the start of any level
  app.get("/api/facilitator/levels", async (req: any) => {
    facilitator(req);
    return { levels: o.content.order.map((id) => { const l = o.content.locks.get(id)!; const r = o.content.rooms.get(l.room); return { id, title: tr(l.title, "es"), room: r ? `${r.number ?? ""} · ${r.stage ? tr(r.stage, "es") : tr(r.title, "es")}` : l.room }; }) };
  });
  app.post("/api/facilitator/jump", async (req) => {
    facilitator(req);
    const b = z.object({ teamId: z.string(), lockId: z.string() }).parse(req.body);
    return o.engine.jumpTo(b.teamId, b.lockId);
  });
  app.post("/api/facilitator/test-team", async (req) => {
    facilitator(req);
    const b = z.object({ alias: z.string().min(2).max(24), lockId: z.string() }).parse(req.body);
    const { teamId } = o.engine.join({ teamAlias: b.alias });
    o.engine.jumpTo(teamId, b.lockId);
    return { teamId, alias: b.alias };
  });
  app.post("/api/facilitator/pause", async (req) => {
    facilitator(req);
    const b = z.object({ paused: z.boolean() }).parse(req.body);
    o.engine.setPaused(b.paused);
    return { ok: true };
  });
  const needCommission = () => { if (!o.commission) throw new GameError(503, "no_commission", "La Comisión no está disponible"); return o.commission; };
  app.get("/api/commission/:teamId", async (req: any) => needCommission().view(req.params.teamId, lang(req.query)));
  app.post("/api/commission/answer", async (req) => { const b = z.object({ teamId: z.string(), answer: z.string().max(2000), evidenceIds: z.array(z.string()).max(3).default([]), lang: L }).parse(req.body); return needCommission().answer(b.teamId, b.answer, b.evidenceIds, b.lang); });
  app.post("/api/locks/skip-bonus", async (req) => { o.engine.skipBonus(z.object({ teamId: z.string() }).parse(req.body).teamId); return { ok: true }; });
  app.get("/api/facilitator/team/:id", async (req: any) => { facilitator(req); return o.engine.teamDetail(req.params.id); });
  app.get("/api/facilitator/export", async (req: any) => { facilitator(req); return o.engine.exportAll(); });
  app.get("/api/facilitator/overview", async (req: any) => {
    facilitator(req);
    return o.engine.overview();
  });

  app.register(async (inst) => {
    inst.get("/ws", { websocket: true }, (socket: any, req: any) => {
      const teamId = String(new URL(req.url, "http://x").searchParams.get("teamId") ?? "");
      if (!teamId) return socket.close();
      if (!sockets.has(teamId)) sockets.set(teamId, new Set());
      sockets.get(teamId)!.add(socket);
      socket.send(JSON.stringify({ type: "hello" }));
      socket.on("close", () => sockets.get(teamId)?.delete(socket));
    });
  });
  const tick = setInterval(() => {
    for (const id of sockets.keys()) send(id, "timer_tick", { serverNow: Date.now() });
  }, 10_000);
  app.addHook("onClose", async () => clearInterval(tick));

  if (o.webDist && fs.existsSync(o.webDist)) {
    app.register(fstatic, { root: path.resolve(o.webDist) });
    app.setNotFoundHandler((req, reply) => (req.url.startsWith("/api") ? reply.status(404).send({ error: "not_found" }) : reply.sendFile("index.html")));
  }
  return app;
}
