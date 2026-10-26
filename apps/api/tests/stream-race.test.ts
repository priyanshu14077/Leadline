import { request } from "node:http";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/db";
import { closeHub, streamCount } from "../src/events";
import { createPractice, deletePractices, sleep, type TestPractice } from "./helpers";

// Widen the window between the stream's writeHead and its subscribe() resolving, which in
// production is the time it takes the LISTEN connection to come up.
vi.mock("../src/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/events")>();
  return {
    ...actual,
    subscribe: async (...args: Parameters<typeof actual.subscribe>) => {
      await new Promise((r) => setTimeout(r, 300));
      return actual.subscribe(...args);
    },
  };
});

let app: FastifyInstance;
let port: number;
let practice: TestPractice;

beforeAll(async () => {
  app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  port = (app.server.address() as { port: number }).port;
  practice = await createPractice("stream-race");
});

afterAll(async () => {
  await deletePractices(practice);
  await app.close();
  await closeHub();
  await prisma.$disconnect();
});

describe("GET /practices/:slug/stream disconnect race", () => {
  it("a tab closed while the stream is still subscribing does not leak a listener", async () => {
    let gotHeadersFirst = false;
    const req = request({ host: "127.0.0.1", port, path: `/practices/${practice.slug}/stream` }, () => {
      gotHeadersFirst = true;
    });
    req.on("error", () => {});
    req.end();
    // Node holds writeHead until the first write ("ready"), which comes after subscribe(). Hang up
    // inside the window, like a tab closed during a slow LISTEN connect.
    await sleep(100);
    req.destroy();
    expect(gotHeadersFirst).toBe(false);
    // Let the delayed subscribe() resolve and any cleanup run.
    await sleep(600);
    expect(streamCount(practice.id)).toBe(0);
  });
});
