// Plays the ad platform: posts signed leads to the real webhook, with retries like Meta/Google.
// bun run simulate [--practice slug] [--count 10] [--every 3] [--dupe-rate 0.25] [--one] [--burst-dupes]
import { parseArgs } from "node:util";
import { fakerEN_GB as faker } from "@faker-js/faker";
import { ENQUIRIES, FIRST_NAMES, LAST_NAMES, PRACTICES, fakeUkMobile } from "../prisma/fixtures";
import type { LeadPayload } from "@leadline/shared";
import { PRACTICE_HEADER, SIGNATURE_HEADER, sign } from "../src/signature";

const { values: opts } = parseArgs({
  options: {
    url: { type: "string", default: `http://localhost:${process.env.API_PORT ?? 4000}/webhooks/leads` },
    practice: { type: "string", default: PRACTICES[0].slug },
    count: { type: "string", default: "10" },
    every: { type: "string", default: "3" },
    "dupe-rate": { type: "string", default: "0.25" },
    one: { type: "boolean", default: false },
    "burst-dupes": { type: "boolean", default: false },
  },
});

const practice = PRACTICES.find((p) => p.slug === opts.practice);
if (!practice) throw new Error(`unknown practice ${opts.practice}; one of ${PRACTICES.map((p) => p.slug).join(", ")}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeLead(): LeadPayload {
  const campaign = faker.helpers.arrayElement(practice!.campaigns);
  const source = campaign.platform === "GOOGLE" ? "GOOGLE_LEAD_FORM" : "META_LEAD_ADS";
  const first = faker.helpers.arrayElement(FIRST_NAMES);
  const last = faker.helpers.arrayElement(LAST_NAMES);
  return {
    source,
    sourceLeadId: source === "META_LEAD_ADS" ? faker.string.numeric(16) : `gl_${faker.string.alphanumeric(20)}`,
    name: `${first} ${last}`,
    email: faker.internet.email({ firstName: first, lastName: last, provider: "example.com" }).toLowerCase(),
    phone: fakeUkMobile(faker.number.int(999)),
    message: faker.helpers.arrayElement(ENQUIRIES[campaign.treatment]),
    utm: { source: campaign.utmSource, medium: "paid_social", campaign: campaign.utmCampaign },
  };
}

async function deliver(lead: LeadPayload, attempt: string) {
  const body = JSON.stringify(lead);
  const res = await fetch(opts.url!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [PRACTICE_HEADER]: practice!.slug,
      [SIGNATURE_HEADER]: sign(practice!.webhookSecret, body),
    },
    body,
  });
  const json = (await res.json()) as { duplicate?: boolean; error?: string };
  const verdict = res.ok ? (json.duplicate ? "duplicate" : "created") : `${res.status} ${json.error}`;
  const trace = res.headers.get("x-request-id") ?? "";
  console.log(`${attempt.padEnd(9)} ${lead.sourceLeadId.padEnd(24)} ${lead.name.padEnd(22)} → ${verdict.padEnd(9)} trace ${trace}`);
}

// A retry resends the identical body after jitter, as platforms do when they miss our 200.
async function deliverWithRetries(lead: LeadPayload, dupeRate: number) {
  await deliver(lead, "send");
  if (faker.number.float() >= dupeRate) return;
  for (let i = 1; i <= faker.number.int({ min: 1, max: 2 }); i++) {
    await sleep(faker.number.int({ min: 50, max: 2000 }));
    await deliver(lead, `retry ${i}`);
  }
}

if (opts["burst-dupes"]) {
  // The video beat: one lead fired three times at once. Expect 1 created, 2 duplicate.
  const lead = fakeLead();
  await Promise.all([1, 2, 3].map((n) => deliver(lead, `burst ${n}`)));
} else if (opts.one) {
  await deliver(fakeLead(), "send");
} else {
  const count = Number(opts.count);
  const dupeRate = Number(opts["dupe-rate"]);
  const pending: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    // Retries run in the background so they interleave with new leads, like real traffic.
    pending.push(deliverWithRetries(fakeLead(), dupeRate));
    if (i < count - 1) await sleep(Number(opts.every) * 1000);
  }
  await Promise.all(pending);
}
