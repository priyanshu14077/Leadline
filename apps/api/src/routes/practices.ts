import { moveLeadBody, treatmentValueBody, type Board, type Practice, type Trace } from "@leadline/shared";
import type { FastifyPluginAsync } from "fastify";
import { recentDeliveries } from "../deliveries";
import { publish, streamCount, subscribe } from "../events";
import { boardLeads, getLeadCard, stageTimestamps } from "../leads";
import { findPractice, listPractices } from "../practice";
import { forPractice, type TenantDb } from "../tenant";

declare module "fastify" {
  interface FastifyRequest {
    practice: Practice;
    db: TenantDb;
  }
}

const HEARTBEAT_MS = 15_000;

export const practiceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (): Promise<Practice[]> => (await listPractices()).map(({ id, slug, name }) => ({ id, slug, name })));
  await app.register(practiceScoped, { prefix: "/:slug" });
};

/**
 * Everything under /practices/:slug. The tenant is resolved once here, and handlers only ever
 * get req.db, a client already scoped to that practice. Demo only: in production the practice
 * comes from the authenticated session, not the URL.
 */
const practiceScoped: FastifyPluginAsync = async (app) => {
  app.decorateRequest("practice", null as unknown as Practice);
  app.decorateRequest("db", null as unknown as TenantDb);
  app.addHook("preHandler", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const practice = await findPractice(slug);
    if (!practice) return reply.code(404).send({ error: "practice not found" });
    req.practice = { id: practice.id, slug: practice.slug, name: practice.name };
    req.db = forPractice(practice.id);
  });

  app.get("/", async (req) => req.practice);

  app.get("/board", async (req): Promise<Board> => {
    const [{ leads, lostCount }, deliveries] = await Promise.all([boardLeads(req.db), recentDeliveries(req.db)]);
    return { leads, lostCount, deliveries };
  });

  app.get("/stream", async (req, reply) => {
    // Take over the raw response: Fastify would otherwise end it when the handler returns.
    // CORS headers were set on reply by the cors hook, so copy them onto the raw head.
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      ...(reply.getHeaders() as Record<string, string>),
      // The onSend hook that echoes the trace id doesn't run for a hijacked reply.
      "x-request-id": req.id,
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    // Listen for the hang-up before awaiting subscribe(): a tab closed while the LISTEN connection
    // comes up would otherwise leave a listener and a heartbeat behind forever.
    let closed = false;
    let cleanup = () => {
      closed = true;
    };
    req.raw.on("close", () => cleanup());
    const write = (chunk: string) => res.write(chunk);
    const ready = () => write("event: ready\ndata: {}\n\n");
    // A second "ready" on an open stream tells the browser to resync: the hub lost events.
    const unsubscribe = await subscribe(
      req.practice.id,
      (msg) => write(`event: ${msg.type}\ndata: ${JSON.stringify(msg)}\n\n`),
      ready,
    );
    if (closed) return unsubscribe();
    // Comment lines keep proxies from closing an idle stream.
    const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
    cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      req.log.info({ practice: req.practice.slug, open: streamCount(req.practice.id) }, "stream closed");
    };
    // Sent on every (re)connect; the browser refreshes on reconnects to catch anything it missed.
    ready();
    req.log.info({ practice: req.practice.slug, open: streamCount(req.practice.id) }, "stream opened");
  });

  app.patch("/leads/:id/stage", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { stage } = moveLeadBody.parse(req.body);
    const lead = await req.db.lead.findUnique({
      where: { id },
      select: { stage: true, firstContactedAt: true, consultBookedAt: true, treatmentAcceptedAt: true },
    });
    if (!lead) return reply.code(404).send({ error: "lead not found" });
    await req.db.lead.update({ where: { id }, data: stageTimestamps(lead, stage) });
    await publish({ type: "lead.updated", practiceId: req.practice.id, leadId: id });
    req.log.info({ leadId: id, from: lead.stage, to: stage }, "lead moved");
    return getLeadCard(req.db, id);
  });

  app.put("/leads/:id/value", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { pounds } = treatmentValueBody.parse(req.body);
    const { count } = await req.db.lead.updateMany({
      where: { id },
      // toFixed first: 10.005 * 100 is 1000.4999… in floating point and would round down a penny.
      data: { treatmentValuePence: pounds === null ? null : Math.round(Number((pounds * 100).toFixed(4))) },
    });
    if (!count) return reply.code(404).send({ error: "lead not found" });
    await publish({ type: "lead.updated", practiceId: req.practice.id, leadId: id });
    return getLeadCard(req.db, id);
  });

  app.get("/traces/:traceId", async (req, reply): Promise<Trace | undefined> => {
    const { traceId } = req.params as { traceId: string };
    const [spans, [delivery]] = await Promise.all([
      req.db.traceSpan.findMany({
        where: { traceId },
        orderBy: { offsetMs: "asc" },
        select: { name: true, offsetMs: true, durationMs: true, detail: true },
      }),
      req.db.webhookDelivery.findMany({ where: { traceId }, select: { id: true }, take: 1 }),
    ]);
    if (!spans.length) return reply.code(404).send({ error: "trace not found" });
    const [row] = delivery ? await recentDeliveries(req.db, { id: delivery.id, take: 1 }) : [];
    return { traceId, delivery: row ?? null, spans };
  });
};
