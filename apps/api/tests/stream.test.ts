import type { LeadCard, StreamMessage, Trace } from "@leadline/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/db";
import { closeHub, streamCount, subscribe } from "../src/events";
import { createPractice, deletePractices, payload, postWebhook, sleep, waitFor, type TestPractice } from "./helpers";
import { openStream } from "./sse";

let app: FastifyInstance;
let base: string;
let practice: TestPractice;
let other: TestPractice;

beforeAll(async () => {
  app = await buildApp();
  // inject() can't drive a hijacked reply, so the stream tests use a real socket on a free port.
  base = await app.listen({ port: 0, host: "127.0.0.1" });
  practice = await createPractice("stream-test");
  other = await createPractice("stream-other");
});

afterAll(async () => {
  await deletePractices(practice, other);
  await app.close();
  await closeHub();
  await prisma.$disconnect();
});

describe("GET /practices/:slug/stream", () => {
  it("opens an SSE stream with CORS headers copied into writeHead and sends ready first", async () => {
    const stream = await openStream(`${base}/practices/${practice.slug}/stream`, {
      origin: "http://localhost:3000",
      "x-request-id": "stream-trace-0001",
    });
    try {
      expect(stream.res.status).toBe(200);
      expect(stream.res.headers.get("content-type")).toBe("text/event-stream");
      expect(stream.res.headers.get("cache-control")).toBe("no-cache, no-transform");
      expect(stream.res.headers.get("x-accel-buffering")).toBe("no");
      expect(stream.res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
      expect(stream.res.headers.get("x-request-id")).toBe("stream-trace-0001");
      await waitFor(() => stream.events.length);
      expect(stream.events[0]).toEqual({ event: "ready", data: {} });
    } finally {
      await stream.close();
    }
  });

  it("delivers a lead to its own clinic's stream and nothing to another clinic's", async () => {
    const mine = await openStream(`${base}/practices/${practice.slug}/stream`);
    const theirs = await openStream(`${base}/practices/${other.slug}/stream`);
    try {
      await waitFor(() => mine.events.length && theirs.events.length);
      const res = await postWebhook(app, practice, JSON.stringify(payload("sse-1")));
      const { leadId } = res.json<{ leadId: string }>();

      const created = await waitFor(() => mine.events.find((e) => e.event === "lead.created"));
      expect((created!.data as StreamMessage & { lead: LeadCard }).lead).toMatchObject({ id: leadId, name: "Amelia Hart", stage: "NEW" });
      await waitFor(() => mine.events.find((e) => e.event === "delivery.logged"));
      // Give the other clinic's stream the same time to (wrongly) receive anything.
      await sleep(200);
      expect(theirs.events.map((e) => e.event)).toEqual(["ready"]);
    } finally {
      await mine.close();
      await theirs.close();
    }
  });

  it("an unknown clinic's stream is a plain 404, not an open stream", async () => {
    const res = await fetch(`${base}/practices/no-such-clinic/stream`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "practice not found" });
  });

  it("unsubscribes when the browser disconnects", async () => {
    const before = streamCount(practice.id);
    const stream = await openStream(`${base}/practices/${practice.slug}/stream`);
    await waitFor(() => stream.events.length);
    expect(streamCount(practice.id)).toBe(before + 1);
    await stream.close();
    expect(await waitFor(() => streamCount(practice.id) === before)).toBe(true);
  });
});

describe("LISTEN hub", () => {
  it("serves many streams over one LISTEN connection", async () => {
    const streams = await Promise.all([1, 2, 3, 4].map(() => openStream(`${base}/practices/${practice.slug}/stream`)));
    const extra = await subscribe(other.id, () => {});
    try {
      await waitFor(() => streams.every((s) => s.events.length));
      const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM pg_stat_activity
        WHERE datname = current_database() AND query ILIKE 'LISTEN lead_events%' AND pid <> pg_backend_pid()`;
      expect(Number(n)).toBe(1);
    } finally {
      extra();
      await Promise.all(streams.map((s) => s.close()));
    }
  });

  it("skips the query and records a 'no open streams' span when nobody watches the clinic", async () => {
    // The hub is connected (someone watches the other clinic), but not this one.
    const unsubscribe = await subscribe(other.id, () => {});
    const traceId = "nowatch-trace-0001";
    await postWebhook(app, practice, JSON.stringify(payload("nowatch-1")), { "x-request-id": traceId });
    const trace = await waitFor(async () => {
      const res = await app.inject({ url: `/practices/${practice.slug}/traces/${traceId}` });
      const t = res.statusCode === 200 ? res.json<Trace>() : null;
      return t?.spans.some((s) => s.name === "no open streams · delivery.logged") ? t : null;
    });
    unsubscribe();
    const names = trace!.spans.map((s) => s.name);
    expect(names).toContain("no open streams · lead.created");
    expect(names.some((n) => n.startsWith("loaded once"))).toBe(false);
  });

  it("delivers lead.updated events in NOTIFY order, so the last one wins", async () => {
    const lead = await prisma.lead.create({
      data: { practiceId: practice.id, source: "WEBSITE", sourceLeadId: "order-1", name: "Order Test", message: "Bonding?" },
    });
    const seen: string[] = [];
    const unsubscribe = await subscribe(practice.id, (m) => {
      if (m.type === "lead.updated" && m.lead.id === lead.id) seen.push(m.lead.stage);
    });
    const moves = ["CONTACTED", "CONSULT_BOOKED", "CONTACTED", "TREATMENT_ACCEPTED", "LOST", "NEW", "CONSULT_BOOKED"] as const;
    for (const stage of moves) {
      await app.inject({ method: "PATCH", url: `/practices/${practice.slug}/leads/${lead.id}/stage`, payload: { stage } });
    }
    await waitFor(() => seen.length === moves.length);
    unsubscribe();
    expect(seen).toHaveLength(moves.length);
    // Each event is resolved after the previous one, so the stream never ends on a stale stage.
    expect(seen.at(-1)).toBe("CONSULT_BOOKED");
  });
});
