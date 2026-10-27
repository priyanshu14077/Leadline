import { leadPayload } from "@leadline/shared";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { ingestLead, logRejected } from "../ingest";
import { findPractice } from "../practice";
import { PRACTICE_HEADER, SIGNATURE_HEADER, verify } from "../signature";
import { RequestTrace, saveSpans } from "../trace";
import { triageLead, type Classify } from "../triage";

declare module "fastify" {
  interface FastifyRequest {
    trace: RequestTrace;
    /** Set when this request created a lead, so triage runs once the response is sent. */
    createdLeadId: string | null;
  }
}

/** classify is the triage model; without it (tests, no API key) leads stay PENDING for the sweeper. */
export const webhookRoutes: FastifyPluginAsync<{ classify?: Classify | null }> = async (app, { classify }) => {
  // Scoped to this plugin: keep the body as the exact bytes received, because the HMAC is over
  // those bytes. Re-serialising parsed JSON would change them.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "string" }, (_req, body, done) => done(null, body));

  app.decorateRequest("trace", null as unknown as RequestTrace);
  app.decorateRequest("createdLeadId", null);
  app.addHook("onRequest", async (req) => {
    req.trace = new RequestTrace(req.id);
    req.trace.mark("request received", `${req.method} ${req.url}`);
  });
  // Spans are written after the response is on the wire, so the platform never waits for them.
  app.addHook("onResponse", async (req, reply) => {
    req.trace.mark("response sent", `HTTP ${reply.statusCode}`);
    const practiceId = req.trace.practiceId;
    if (practiceId) await saveSpans(practiceId, req.trace.traceId, req.trace.spans);
    if (practiceId && req.createdLeadId && classify) runTriage(practiceId, req.createdLeadId, req);
  });

  // Triage runs after the 200, so a slow or failing model call can never cost the platform a retry
  // or lose a lead. Its spans join the webhook's trace, on the same clock.
  const inFlight = new Set<Promise<void>>();
  function runTriage(practiceId: string, leadId: string, req: FastifyRequest) {
    const trace = new RequestTrace(req.trace.traceId, req.trace.startedAt);
    const job = triageLead(practiceId, leadId, classify!, trace)
      .then(async (outcome) => {
        req.log.info({ leadId, outcome }, "lead triaged");
        await saveSpans(practiceId, trace.traceId, trace.spans);
      })
      .catch((err) => req.log.error({ err, leadId }, "triage crashed"))
      .finally(() => inFlight.delete(job));
    inFlight.add(job);
  }
  // Let running triage finish on shutdown instead of cutting it off mid-write.
  app.addHook("onClose", async () => {
    await Promise.all(inFlight);
  });

  app.post("/webhooks/leads", async (req, reply) => {
    const trace = req.trace;
    const raw = typeof req.body === "string" ? req.body : "";
    trace.mark("body read", `${Buffer.byteLength(raw)} bytes`);

    const slug = req.headers[PRACTICE_HEADER];
    const practice = typeof slug === "string" ? await trace.time("practice looked up", () => findPractice(slug)) : null;
    const signature = req.headers[SIGNATURE_HEADER];
    const valid = practice && (await trace.time("signature verified", async () => verify(practice.webhookSecret, raw, typeof signature === "string" ? signature : null)));
    // Same 401 for unknown practice and bad signature, so the endpoint doesn't confirm which slugs exist.
    // Nothing is written to the DB: unauthenticated callers must not be able to create rows.
    if (!practice || !valid) {
      req.log.warn({ practice: slug ?? null, reason: practice ? "bad signature" : "unknown practice" }, "webhook rejected");
      return reply.code(401).send({ error: "invalid signature" });
    }
    trace.practiceId = practice.id;

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      await logRejected(practice.id, "unknown", undefined, trace);
      req.log.warn({ practice: practice.slug }, "webhook body is not JSON");
      return reply.code(400).send({ error: "body is not JSON" });
    }

    const parsed = leadPayload.safeParse(body);
    if (!parsed.success) {
      trace.mark("payload invalid", parsed.error.issues.map((i) => i.path.join(".") || "body").join(", "));
      const b = body as { source?: unknown; sourceLeadId?: unknown };
      await logRejected(
        practice.id,
        typeof b?.source === "string" ? b.source : "unknown",
        typeof b?.sourceLeadId === "string" ? b.sourceLeadId : undefined,
        trace,
      );
      req.log.warn({ practice: practice.slug, issues: parsed.error.issues.length }, "webhook payload invalid");
      return reply.code(400).send({ error: "invalid payload", issues: parsed.error.issues });
    }
    trace.mark("payload validated", `${parsed.data.source} ${parsed.data.sourceLeadId}`);

    const result = await ingestLead(practice.id, parsed.data, trace);
    if (result.outcome === "CREATED") req.createdLeadId = result.leadId;
    req.log.info(
      { practice: practice.slug, source: parsed.data.source, sourceLeadId: parsed.data.sourceLeadId, outcome: result.outcome, leadId: result.leadId },
      "webhook ingested",
    );
    // A duplicate is still a 200: a 4xx/5xx would make the platform retry the same lead again.
    return { leadId: result.leadId, duplicate: result.outcome === "DUPLICATE", traceId: trace.traceId };
  });
};
