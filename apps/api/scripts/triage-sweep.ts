// Triages every lead still PENDING (seeded leads, model outages) or FAILED under the attempt cap.
// One lead at a time, paced for the Gemini free tier; open boards update live as each one lands.
// bun run triage:sweep [--practice slug] [--limit 100] [--every 4] [--max-attempts 3]
import { parseArgs } from "node:util";
import { prisma } from "../src/db";
import { closeHub } from "../src/events";
import { listPractices } from "../src/practice";
import { forPractice } from "../src/tenant";
import { geminiClassifier, triageLead } from "../src/triage";

const { values: opts } = parseArgs({
  options: {
    practice: { type: "string" },
    limit: { type: "string", default: "100" },
    every: { type: "string", default: "4" },
    "max-attempts": { type: "string", default: "3" },
  },
});

const classify = geminiClassifier();
if (!classify) throw new Error("GEMINI_API_KEY is not set in the root .env");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const every = Number(opts.every) * 1000;
const maxAttempts = Number(opts["max-attempts"]);
let budget = Number(opts.limit);
// Back off on rate limits and outages, up to 2 minutes; a success resets it.
let backoff = 0;
const tally = { DONE: 0, FAILED: 0, BUSY: 0, SKIPPED: 0 };

const practices = (await listPractices()).filter((p) => !opts.practice || p.slug === opts.practice);
if (!practices.length) throw new Error(`unknown practice ${opts.practice}`);

for (const practice of practices) {
  // Newest first: those are the cards on the board.
  const leads = await forPractice(practice.id).lead.findMany({
    where: { OR: [{ triageStatus: "PENDING" }, { triageStatus: "FAILED", triageAttempts: { lt: maxAttempts } }] },
    select: { id: true, name: true },
    orderBy: { receivedAt: "desc" },
    take: budget,
  });
  console.log(`${practice.slug}: ${leads.length} to triage`);

  for (const [i, lead] of leads.entries()) {
    if (budget-- <= 0) break;
    const started = Date.now();
    const outcome = await triageLead(practice.id, lead.id, classify);
    tally[outcome]++;
    console.log(`  ${outcome.padEnd(7)} ${lead.name.padEnd(22)} ${((Date.now() - started) / 1000).toFixed(1)}s`);
    backoff = outcome === "BUSY" ? Math.min(Math.max(backoff * 2, 15_000), 120_000) : 0;
    if (backoff) console.log(`  model busy, waiting ${backoff / 1000}s`);
    if (i < leads.length - 1) await sleep(Math.max(every - (Date.now() - started), backoff, 0));
  }
}

console.log(`done: ${tally.DONE} triaged, ${tally.FAILED} failed, ${tally.BUSY} left PENDING (model busy), ${tally.SKIPPED} skipped`);
await closeHub();
await prisma.$disconnect();
