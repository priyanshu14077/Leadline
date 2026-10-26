import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import Fastify, { type FastifyError, type FastifyServerOptions } from "fastify";
import { ZodError } from "zod";
import { practiceRoutes } from "./routes/practices";
import { webhookRoutes } from "./routes/webhooks";

const REQUEST_ID = /^[\w-]{8,64}$/;

export async function buildApp(opts: { logger?: FastifyServerOptions["logger"] } = {}) {
  const app = Fastify({
    logger: opts.logger ?? false,
    // Trust a well-formed x-request-id from the caller (an upstream proxy or platform), else mint one.
    // It becomes req.id: on every log line, in the response header, and as the webhook's trace id.
    requestIdHeader: false,
    genReqId: (req) => {
      const given = req.headers["x-request-id"];
      return typeof given === "string" && REQUEST_ID.test(given) ? given : randomUUID();
    },
  });

  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });

  app.setErrorHandler((err: FastifyError | ZodError, req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: "invalid body", issues: err.issues });
    // Client mistakes (4xx) are warnings; only server faults are errors, so error-rate alerts stay meaningful.
    if (err.statusCode && err.statusCode < 500) req.log.warn({ err }, "request rejected");
    else req.log.error({ err }, "unhandled error");
    return reply.code(err.statusCode ?? 500).send({ error: err.statusCode && err.statusCode < 500 ? err.message : "internal error" });
  });

  // Browsers on the web app may call the API directly; nothing else may.
  await app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    methods: ["GET", "PATCH", "PUT"],
    exposedHeaders: ["x-request-id"],
  });

  app.get("/health", async () => ({ ok: true }));
  await app.register(webhookRoutes);
  await app.register(practiceRoutes, { prefix: "/practices" });
  return app;
}
