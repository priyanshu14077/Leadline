import type { StreamMessage, Trace } from "@leadline/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/db";
import { closeHub, subscribe } from "../src/events";
import { ingestLead } from "../src/ingest";
import { TriageBusy, geminiClassifier, triageLead, type Classify, type TriageResult } from "../src/triage";
import { createPractice, deletePractices, payload, postWebhook, sleep, waitFor, type TestPractice } from "./helpers";

const RESULT: TriageResult = { treatmentInterest: "INVISALIGN", urgency: "MEDIUM", objections: ["PRICE"], opener: "Hi Amelia, thanks for asking about Invisalign." };
const answers: Classify = async () => RESULT;

let practice: TestPractice;
let other: TestPractice;
let app: FastifyInstance;
// Each test sets what the webhook's model does; the app holds a stable wrapper around it.
let model: Classify = answers;

beforeAll(async () => {
  app = await buildApp({ classify: (e) => model(e) });
  practice = await createPractice("triage-test");
  other = await createPractice("triage-other");
});

afterAll(async () => {
  await app.close();
  await deletePractices(practice, other);
  await closeHub();
});

afterEach(() => {
  model = answers;
  vi.unstubAllGlobals();
});

const lead = (id: string) => prisma.lead.findFirstOrThrow({ where: { practiceId: practice.id, sourceLeadId: id } });

describe("triageLead", () => {
  it("stores the model's answer, marks the lead DONE and pushes it to open boards", async () => {
    const heard: StreamMessage[] = [];
    const unsubscribe = await subscribe(practice.id, (m) => heard.push(m));
    const { leadId } = await ingestLead(practice.id, payload("t-done"));

    const seen: string[] = [];
    expect(await triageLead(practice.id, leadId, async (e) => (seen.push(e.firstName), RESULT))).toBe("DONE");

    expect(seen).toEqual(["Amelia"]); // first name only, for the opener
    expect(await lead("t-done")).toMatchObject({
      triageStatus: "DONE",
      treatmentInterest: "INVISALIGN",
      urgency: "MEDIUM",
      objections: ["PRICE"],
      triageOpener: RESULT.opener,
    });
    await waitFor(() => heard.some((m) => m.type === "lead.updated" && m.lead.id === leadId && m.lead.triageStatus === "DONE"));
    unsubscribe();
  });

  it("leaves the lead PENDING, without counting an attempt, when the model is busy", async () => {
    const { leadId } = await ingestLead(practice.id, payload("t-busy"));
    const busy: Classify = async () => {
      throw new TriageBusy("429 quota");
    };
    expect(await triageLead(practice.id, leadId, busy)).toBe("BUSY");
    expect(await lead("t-busy")).toMatchObject({ triageStatus: "PENDING", triageAttempts: 0 });
  });

  it("marks the lead FAILED and counts the attempt when the answer is unusable", async () => {
    const { leadId } = await ingestLead(practice.id, payload("t-fail"));
    const broken: Classify = async () => {
      throw new SyntaxError("Unexpected token");
    };
    expect(await triageLead(practice.id, leadId, broken)).toBe("FAILED");
    expect(await lead("t-fail")).toMatchObject({ triageStatus: "FAILED", triageAttempts: 1, treatmentInterest: null });

    // The sweeper's retry can still succeed.
    expect(await triageLead(practice.id, leadId, answers)).toBe("DONE");
    expect(await lead("t-fail")).toMatchObject({ triageStatus: "DONE", triageAttempts: 1 });
  });

  it("never calls the model again for a lead that's already triaged", async () => {
    const { leadId } = await ingestLead(practice.id, payload("t-twice"));
    await triageLead(practice.id, leadId, answers);
    const spy = vi.fn(answers);
    expect(await triageLead(practice.id, leadId, spy)).toBe("SKIPPED");
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps the first answer when two runs race", async () => {
    const { leadId } = await ingestLead(practice.id, payload("t-race"));
    const slow: Classify = async () => (await sleep(50), { ...RESULT, opener: "slow" });
    const fast: Classify = async () => ({ ...RESULT, opener: "fast" });
    const outcomes = await Promise.all([triageLead(practice.id, leadId, slow), triageLead(practice.id, leadId, fast)]);
    expect(outcomes.sort()).toEqual(["DONE", "SKIPPED"]);
    expect((await lead("t-race")).triageOpener).toBe("fast");
  });

  it("can't triage another clinic's lead", async () => {
    const { leadId } = await ingestLead(practice.id, payload("t-tenant"));
    const spy = vi.fn(answers);
    expect(await triageLead(other.id, leadId, spy)).toBe("SKIPPED");
    expect(spy).not.toHaveBeenCalled();
    expect((await lead("t-tenant")).triageStatus).toBe("PENDING");
  });
});

describe("triage after the webhook", () => {
  it("triages a new lead after the 200 and adds the model call to the webhook's trace", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    model = async () => (await gate, RESULT);

    const traceId = "triage-trace-0001";
    const res = await postWebhook(app, practice, JSON.stringify(payload("t-hook")), { "x-request-id": traceId });
    // The response went out while the model was still "thinking".
    expect(res.statusCode).toBe(200);
    expect((await lead("t-hook")).triageStatus).toBe("PENDING");

    release();
    expect(await waitFor(async () => (await lead("t-hook")).triageStatus === "DONE")).toBe(true);
    const trace = await waitFor(async () => {
      const r = await app.inject({ url: `/practices/${practice.slug}/traces/${traceId}` });
      const t = r.json<Trace>();
      return t.spans?.some((s) => s.name === "triage saved") ? t : null;
    });
    const names = trace!.spans.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["response sent", "triage · Gemini call", "triage saved"]));
    // Same clock: the model call starts after the response was sent.
    const at = (n: string) => trace!.spans.find((s) => s.name === n)!.offsetMs;
    expect(at("triage · Gemini call")).toBeGreaterThanOrEqual(at("response sent"));
  });

  it("doesn't triage a duplicate delivery", async () => {
    const body = JSON.stringify(payload("t-dupe"));
    await postWebhook(app, practice, body);
    await waitFor(async () => (await lead("t-dupe")).triageStatus === "DONE");

    const spy = vi.fn(answers);
    model = spy;
    expect((await postWebhook(app, practice, body)).json()).toMatchObject({ duplicate: true });
    await sleep(100);
    expect(spy).not.toHaveBeenCalled();
  });

  it("answers 200 even when the model blows up", async () => {
    model = async () => {
      throw new Error("model exploded");
    };
    const res = await postWebhook(app, practice, JSON.stringify(payload("t-boom")));
    expect(res.statusCode).toBe(200);
    expect(await waitFor(async () => (await lead("t-boom")).triageStatus === "FAILED")).toBe(true);
  });
});

describe("geminiClassifier", () => {
  const reply = (status: number, body: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));
  const enquiry = { firstName: "Amelia", message: "How much is Invisalign?" };

  it("is off without an API key", () => {
    expect(geminiClassifier("")).toBeNull();
  });

  it("parses a schema-shaped answer", async () => {
    reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ ...RESULT, objections: ["PRICE", "PRICE"] }) }] } }] });
    expect(await geminiClassifier("test-key")!(enquiry)).toEqual(RESULT);
  });

  it("treats rate limits and outages as busy", async () => {
    reply(429, { error: { code: 429, message: "quota", status: "RESOURCE_EXHAUSTED" } });
    await expect(geminiClassifier("test-key")!(enquiry)).rejects.toBeInstanceOf(TriageBusy);
    reply(503, { error: { code: 503, message: "high demand", status: "UNAVAILABLE" } });
    await expect(geminiClassifier("test-key")!(enquiry)).rejects.toBeInstanceOf(TriageBusy);
  });

  it("treats a bad request or an off-schema answer as a failure, not busy", async () => {
    reply(400, { error: { code: 400, message: "bad", status: "INVALID_ARGUMENT" } });
    await expect(geminiClassifier("test-key")!(enquiry)).rejects.not.toBeInstanceOf(TriageBusy);
    reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ ...RESULT, urgency: "EXTREME" }) }] } }] });
    await expect(geminiClassifier("test-key")!(enquiry)).rejects.not.toBeInstanceOf(TriageBusy);
  });
});
