import { buildApp } from "./app";
import { closeHub } from "./events";
import { prisma } from "./db";

const app = await buildApp({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    // Pretty, single-line logs in dev; plain JSON (for log-based metrics) when NODE_ENV=production.
    transport:
      process.env.NODE_ENV === "production"
        ? undefined
        : { target: "pino-pretty", options: { translateTime: "HH:MM:ss.l", ignore: "pid,hostname", singleLine: true } },
  },
});

const port = Number(process.env.API_PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close();
    await closeHub();
    await prisma.$disconnect();
    process.exit(0);
  });
}
