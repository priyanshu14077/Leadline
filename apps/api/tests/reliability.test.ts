import type { StreamMessage } from "@leadline/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/db";
import { closeHub, subscribe } from "../src/events";
import { ingestLead } from "../src/ingest";
import { NO_TRACE, type Tracer } from "../src/trace";
import { createPractice, deletePractices, payload, sleep, waitFor, type TestPractice } from "./helpers";

let practice: TestPractice;
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  practice = await createPractice("reliability-test");
});

afterAll(async () => {
  await deletePractices(practice);
  await app.close();
  await closeHub();
});

describe("ingest is atomic", () => {
  it("a failure after the insert rolls back the lead, the delivery and the NOTIFY together", async () => {
    const heard: StreamMessage[] = [];
    const unsubscribe = await subscribe(practice.id, (msg) => heard.push(msg));

    // A tracer that blows up at the delivery step stands in for a crash mid-ingest.
    const crashing: Tracer = {
      ...NO_TRACE,
      time<T>(name: string, fn: () => Promise<T>) {
        if (name === "delivery logged") return Promise.reject(new Error("simulated crash"));
        return fn();
      },
    };
    await expect(ingestLead(practice.id, payload("atomic-1"), crashing)).rejects.toThrow("simulated crash");
    await sleep(300); // long enough for a NOTIFY to arrive if one had been sent

    expect(await prisma.lead.count({ where: { practiceId: practice.id, sourceLeadId: "atomic-1" } })).toBe(0);
    expect(await prisma.webhookDelivery.count({ where: { practiceId: practice.id, sourceLeadId: "atomic-1" } })).toBe(0);
    expect(heard).toEqual([]);

    // The platform's retry is therefore a fresh CREATED, and this time the board hears about it.
    const retry = await ingestLead(practice.id, payload("atomic-1"));
    expect(retry.outcome).toBe("CREATED");
    await waitFor(() => heard.some((m) => m.type === "lead.created"));
    unsubscribe();
  });
});

describe("LISTEN connection recovery", () => {
  it("tells every open stream to resync when the hub's LISTEN connection comes back", async () => {
    let resyncs = 0;
    const unsubscribe = await subscribe(practice.id, () => {}, () => resyncs++);

    // Kill the hub's LISTEN backend from the database side, as a failover or idle-kill would.
    await prisma.$executeRaw`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = current_database() AND query ILIKE 'LISTEN lead_events%' AND pid <> pg_backend_pid()`;

    expect(await waitFor(() => resyncs > 0, 5000)).toBe(true);

    // And it is really listening again: a new lead reaches the subscriber.
    const heard: string[] = [];
    const second = await subscribe(practice.id, (m) => heard.push(m.type));
    await ingestLead(practice.id, payload("after-reconnect-1"));
    expect(await waitFor(() => heard.includes("lead.created"))).toBe(true);
    second();
    unsubscribe();
  });
});

describe("treatment value", () => {
  it("rounds half pennies up instead of losing one to floating point", async () => {
    const { leadId } = await ingestLead(practice.id, payload("penny-1"));
    const res = await app.inject({
      method: "PUT",
      url: `/practices/${practice.slug}/leads/${leadId}/value`,
      payload: { pounds: 10.005 },
    });
    expect(res.json()).toMatchObject({ treatmentValuePence: 1001 });
  });
});
