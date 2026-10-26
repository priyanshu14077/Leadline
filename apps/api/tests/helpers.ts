import type { LeadPayload } from "@leadline/shared";
import type { FastifyInstance } from "fastify";
import { prisma } from "../src/db";
import { PRACTICE_HEADER, SIGNATURE_HEADER, sign } from "../src/signature";

export type TestPractice = { id: string; slug: string; webhookSecret: string };

/** A throwaway clinic. Deleting it cascades to its campaigns, leads, deliveries and spans. */
export function createPractice(slug: string): Promise<TestPractice> {
  return prisma.practice.create({
    data: { slug, name: `Clinic ${slug}`, webhookSecret: `whsec_${slug}` },
    select: { id: true, slug: true, webhookSecret: true },
  });
}

export function deletePractices(...practices: (TestPractice | undefined)[]) {
  const ids = practices.filter((p): p is TestPractice => !!p).map((p) => p.id);
  return prisma.practice.deleteMany({ where: { id: { in: ids } } });
}

export const payload = (sourceLeadId: string, overrides: Partial<LeadPayload> = {}): LeadPayload => ({
  source: "META_LEAD_ADS",
  sourceLeadId,
  name: "Amelia Hart",
  email: "amelia@example.com",
  phone: "07700 900123",
  message: "How much is Invisalign?",
  utm: { source: "facebook", campaign: "invisalign_test" },
  ...overrides,
});

export function postWebhook(
  app: FastifyInstance,
  practice: TestPractice,
  body: string,
  headers: Record<string, string> = {},
) {
  return app.inject({
    method: "POST",
    url: "/webhooks/leads",
    headers: {
      [PRACTICE_HEADER]: practice.slug,
      [SIGNATURE_HEADER]: sign(practice.webhookSecret, body),
      "content-type": "application/json",
      ...headers,
    },
    payload: body,
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polls until check() returns a truthy value or the deadline passes. */
export async function waitFor<T>(check: () => Promise<T> | T, timeoutMs = 3000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value || Date.now() > deadline) return value;
    await sleep(25);
  }
}
