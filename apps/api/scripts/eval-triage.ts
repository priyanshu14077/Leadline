// Scores the triage model against 20 hand-labelled enquiries. Doesn't touch the database.
// bun run triage:eval [--every 4] [--model gemini-3.5-flash-lite]
import { parseArgs } from "node:util";
import { DEFAULT_MODEL, TriageBusy, geminiClassifier, type TriageResult } from "../src/triage";
import { EVAL_SET } from "./eval-set";

const { values: opts } = parseArgs({
  options: {
    every: { type: "string", default: "4" },
    model: { type: "string", default: process.env.GEMINI_MODEL ?? DEFAULT_MODEL },
  },
});

const classify = geminiClassifier(process.env.GEMINI_API_KEY, opts.model);
if (!classify) throw new Error("GEMINI_API_KEY is not set in the root .env");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

// Rate limits get up to 3 waits; anything else counts as a miss on every field.
async function run(c: (typeof EVAL_SET)[number]): Promise<TriageResult | Error> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await classify!({ firstName: c.firstName, message: c.message });
    } catch (err) {
      if (err instanceof TriageBusy && attempt < 3) {
        console.log(`  busy, retrying in ${15 * 2 ** attempt}s`);
        await sleep(15_000 * 2 ** attempt);
        continue;
      }
      return err instanceof Error ? err : new Error(String(err));
    }
  }
}

const score = { treatment: 0, urgency: 0, objections: 0, errors: 0 };
const misses: string[] = [];
const latencies: number[] = [];

console.log(`model ${opts.model}, ${EVAL_SET.length} cases\n`);
for (const [i, c] of EVAL_SET.entries()) {
  const started = Date.now();
  const got = await run(c);
  latencies.push(Date.now() - started);
  const label = `#${String(i + 1).padStart(2)} ${c.firstName}`;
  if (got instanceof Error) {
    score.errors++;
    misses.push(`${label}: error ${got.message.slice(0, 100)}`);
    console.log(`${label}  ERROR`);
  } else {
    const t = got.treatmentInterest === c.treatment;
    const u = got.urgency === c.urgency;
    const o = sameSet(got.objections, c.objections);
    score.treatment += +t;
    score.urgency += +u;
    score.objections += +o;
    if (!t) misses.push(`${label}: treatment ${got.treatmentInterest}, expected ${c.treatment}`);
    if (!u) misses.push(`${label}: urgency ${got.urgency}, expected ${c.urgency}`);
    if (!o) misses.push(`${label}: objections [${got.objections}], expected [${c.objections}]`);
    console.log(`${label}  ${t ? "✓" : "✗"} treatment  ${u ? "✓" : "✗"} urgency  ${o ? "✓" : "✗"} objections   "${got.opener}"`);
  }
  if (i < EVAL_SET.length - 1) await sleep(Math.max(Number(opts.every) * 1000 - (Date.now() - started), 0));
}

const n = EVAL_SET.length;
const pct = (k: number) => `${k}/${n} (${Math.round((k / n) * 100)}%)`;
const sorted = [...latencies].sort((a, b) => a - b);
console.log(`\ntreatment   ${pct(score.treatment)}`);
console.log(`urgency     ${pct(score.urgency)}`);
console.log(`objections  ${pct(score.objections)} exact set match`);
console.log(`errors      ${score.errors}`);
console.log(`latency     median ${(sorted[Math.floor(n / 2)] / 1000).toFixed(1)}s, max ${(sorted[n - 1] / 1000).toFixed(1)}s`);
if (misses.length) console.log(`\nmisses:\n  ${misses.join("\n  ")}`);
