import { ArrowRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { PostmarkMark, Wordmark } from "@/components/brand/wordmark";
import { OutcomeStamp } from "@/components/deliveries/outcome-stamp";
import { HeroDocket } from "@/components/landing/hero-docket";
import { cn } from "@/lib/utils";

/** Static shell: no data, nothing per request. */

const BAND = "bg-[oklch(0.965_0.006_255)]";

/** One arm of the registered envelope's cross: a paper band with a blue double rule. */
function Band({ vertical, className }: { vertical?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("relative", BAND, className)}>
      <span className={cn("absolute bg-rail", vertical ? "inset-y-0 left-2 w-[2px]" : "inset-x-0 top-2 h-[2px]")} />
      <span className={cn("absolute bg-rail", vertical ? "inset-y-0 right-2 w-[2px]" : "inset-x-0 bottom-2 h-[2px]")} />
    </div>
  );
}

function PrimaryCta({ className }: { className?: string }) {
  return (
    <Link
      href="/app"
      className={cn(
        "group inline-flex h-12 items-center gap-2 rounded-md bg-[oklch(0.985_0.004_255)] px-5 text-[0.95rem] font-semibold text-rail shadow-[0_1px_0_oklch(0.1_0.05_264/0.3)] transition-colors hover:bg-white focus-visible:outline-[oklch(0.985_0.004_255)]",
        className,
      )}
    >
      Open the live board
      <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function Hero() {
  return (
    <header className="relative overflow-hidden bg-rail text-rail-foreground">
      <div className="mx-auto grid min-h-[min(100svh,58rem)] max-w-[90rem] grid-cols-1 grid-rows-[auto_auto_3.5rem_auto_auto] lg:grid-cols-[minmax(0,1fr)_3.5rem_minmax(22rem,30rem)] lg:grid-rows-[auto_1fr_3.5rem_auto]">
        <nav aria-label="Main" className="col-span-full row-start-1 flex items-center gap-6 px-5 py-5 sm:px-8 lg:px-12">
          <Link href="/" aria-label="LeadLine home" className="rounded-md">
            <Wordmark />
          </Link>
          <ul className="ml-auto hidden items-center gap-6 text-sm text-rail-muted md:flex">
            <li>
              <a href="#how" className="hover:text-rail-foreground">
                How it works
              </a>
            </li>
            <li>
              <a href="#built" className="hover:text-rail-foreground">
                What&apos;s built
              </a>
            </li>
            <li>
              <Link href="/demo/form" className="hover:text-rail-foreground">
                Try the ad form
              </Link>
            </li>
          </ul>
          <Link
            href="/app"
            className="ml-auto inline-flex h-9 items-center rounded-md border border-white/30 px-3 text-sm font-medium hover:bg-white/10 md:ml-0"
          >
            Live demo
          </Link>
        </nav>

        <div className="row-start-2 flex items-end px-5 pt-6 pb-8 sm:px-8 lg:col-start-1 lg:row-start-2 lg:px-12 lg:pb-10">
          <h1 className="type-display text-[clamp(3.4rem,9.5vw,6rem)] text-balance">
            Every enquiry,
            <br />
            signed for.
          </h1>
        </div>

        <Band className="col-span-full row-start-3" />
        <Band vertical className="hidden lg:col-start-2 lg:row-start-2 lg:row-end-5 lg:block" />

        <div className="row-start-4 px-5 pt-7 pb-10 sm:px-8 lg:col-start-1 lg:row-start-4 lg:px-12 lg:pt-9 lg:pb-14">
          <p className="max-w-[34rem] text-lg leading-relaxed text-pretty text-rail-foreground/90">
            LeadLine is a live lead board for cosmetic dental clinics. Leads from your Meta and Google ads land once, in under a
            second, and your team can see who has waited longest for a call.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <PrimaryCta />
            <Link href="/demo/form" className="text-sm font-medium text-rail-foreground underline decoration-white/40 hover:decoration-white">
              Send yourself a lead
            </Link>
          </div>
        </div>

        <div className="relative z-10 row-start-5 px-5 pb-12 sm:px-8 lg:col-start-3 lg:row-span-3 lg:row-start-2 lg:flex lg:items-center lg:px-8 lg:pb-0 xl:pr-12">
          <HeroDocket />
        </div>
      </div>
    </header>
  );
}

const PROBLEMS = [
  {
    title: "Leads go cold in minutes.",
    body: "Someone fills in an Invisalign form at 20:41 while scrolling Instagram. If nobody rings for two hours, they've forgotten, or filled in a competitor's form.",
  },
  {
    title: "Platforms send the same lead twice.",
    body: "Ad platforms resend a lead when they don't get a fast answer. Two closers ring the same patient, and cost per lead looks better than it is.",
  },
  {
    title: "Nobody can prove a lead arrived.",
    body: "Leads land in a Meta inbox, a CSV, an email notification. When one never reaches the team, nothing records that it existed.",
  },
];

function Problem() {
  return (
    <section aria-labelledby="problem" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
      <h2 id="problem" className="max-w-3xl text-[clamp(1.9rem,3.6vw,2.75rem)] leading-[1.08] font-semibold tracking-[-0.015em] text-balance">
        A treatment plan is worth thousands. A lead nobody rings is ad spend wasted.
      </h2>
      <ul className="perforated-top mt-12">
        {PROBLEMS.map((p) => (
          <li key={p.title} className="perforated grid gap-2 py-6 md:grid-cols-[minmax(0,22rem)_1fr] md:gap-10">
            <h3 className="text-lg font-semibold">{p.title}</h3>
            <p className="max-w-prose text-muted-foreground">{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEPS = [
  { title: "Form submitted", body: "A patient fills in your ad's lead form. The platform sends it to LeadLine.", span: "request received" },
  { title: "Signature checked", body: "The request must carry your clinic's signature. Strangers can't post fake leads.", span: "signature verified" },
  { title: "Stored once", body: "The database keeps one lead per platform id. Every retry is logged, none is stored twice.", span: "lead insert · ON CONFLICT DO NOTHING" },
  { title: "On every screen", body: "The card appears on every open board with its clock already running.", span: "SSE push · lead.created" },
];

function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-6 bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
        <h2 id="how-title" className="text-[clamp(1.9rem,3.6vw,2.75rem)] leading-[1.08] font-semibold tracking-[-0.015em]">
          How a lead reaches the board
        </h2>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Tracked like registered post. Each step is recorded with its timing, and you can open any request and see them.
        </p>
        <ol className="relative mt-12 grid gap-8 md:grid-cols-4 md:gap-6">
          <span aria-hidden className="absolute top-[7px] right-0 left-0 hidden h-[2px] bg-brand/25 md:block" />
          {STEPS.map((s) => (
            <li key={s.title} className="relative pl-7 md:pt-8 md:pl-0">
              <span aria-hidden className="absolute top-1 left-0 size-4 rounded-full border-[3px] border-brand bg-surface md:top-0" />
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              <p className="mt-3 inline-block rounded bg-card px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground">{s.span}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Timer({ tone, children }: { tone: "ok" | "warn" | "overdue"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-full px-2.5 font-mono text-sm font-medium tabular-nums",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "overdue" && "bg-overdue-soft text-overdue",
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

const FEATURES: { title: string; body: string; demo: React.ReactNode }[] = [
  {
    title: "A live pipeline",
    body: "New, Contacted, Consult booked, Treatment accepted. Drag a card, or use its Move menu. Every open screen updates at once, with no refresh.",
    demo: (
      <div className="flex flex-wrap gap-2">
        {[
          ["New", "bg-stage-new"],
          ["Contacted", "bg-stage-contacted"],
          ["Consult booked", "bg-stage-consult"],
          ["Treatment accepted", "bg-stage-accepted"],
        ].map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1.5 text-sm">
            <span aria-hidden className={cn("size-2 rounded-full", color)} />
            {label}
          </span>
        ))}
      </div>
    ),
  },
  {
    title: "Speed-to-lead, counted",
    body: "Every new lead carries a clock from the moment it arrived: green, amber at 3 minutes, red at 5. The board says how many are over 5 minutes.",
    demo: (
      <div className="flex flex-wrap items-center gap-2">
        <Timer tone="ok">1:12</Timer>
        <Timer tone="warn">3:40</Timer>
        <Timer tone="overdue">7m</Timer>
      </div>
    ),
  },
  {
    title: "AI reads the enquiry",
    body: "Gemini reads each new enquiry once it's saved and suggests the treatment, the urgency, the patient's concerns and an opening line for the call. A slow or failed model call never holds up the lead.",
    demo: (
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-sm bg-brand-soft px-1.5 py-0.5 font-medium text-brand">Invisalign</span>
        <span className="rounded-sm bg-overdue-soft px-1.5 py-0.5 text-overdue">Urgent</span>
        <span className="rounded-sm border px-1.5 py-0.5 text-muted-foreground">Concern: price</span>
      </div>
    ),
  },
  {
    title: "One lead, once",
    body: "Retries of the same lead are caught by the database, not by hope. The delivery log shows every attempt, so three deliveries visibly become one lead.",
    demo: (
      <div className="flex flex-wrap items-center gap-2">
        <OutcomeStamp outcome="CREATED" />
        <OutcomeStamp outcome="DUPLICATE" />
        <OutcomeStamp outcome="DUPLICATE" />
        <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-sm font-semibold">1 lead</span>
      </div>
    ),
  },
  {
    title: "Every request traceable",
    body: "Open any delivery to see each step it took, in milliseconds: the webhook handler, then the hub that pushed it to open screens.",
    demo: (
      <div className="w-full max-w-xs space-y-1.5" aria-hidden>
        {[
          ["bg-brand", "4%", "30%"],
          ["bg-brand", "36%", "22%"],
          ["bg-hub", "62%", "14%"],
          ["bg-hub", "78%", "12%"],
        ].map(([color, left, width], i) => (
          <div key={i} className="relative h-2.5 rounded-sm bg-surface">
            <span className={cn("absolute inset-y-0 rounded-[2px]", color)} style={{ left, width }} />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Which campaign made money",
    body: "Each campaign followed past the form fill to booked consults and accepted plans: cost per booked consult, and treatment value back per £1 of ad spend.",
    demo: (
      <dl className="grid grid-cols-2 gap-x-6 text-sm">
        <dt className="type-label text-[0.72rem] text-muted-foreground">Cost per consult</dt>
        <dt className="type-label text-[0.72rem] text-muted-foreground">Back per £1</dt>
        <dd className="font-mono text-lg tabular-nums">£48</dd>
        <dd className="font-mono text-lg font-semibold tabular-nums">£6.40</dd>
      </dl>
    ),
  },
  {
    title: "Each clinic kept apart",
    body: "One agency, many competing clinics. Every query is scoped to one clinic by construction, so one clinic never sees another's patients.",
    demo: (
      <div className="flex items-stretch overflow-hidden rounded-md border text-sm">
        <span className="px-3 py-2">Smile Studio London</span>
        <span aria-hidden className="w-1.5 bg-[repeating-linear-gradient(45deg,var(--border)_0_2px,transparent_2px_5px)]" />
        <span className="px-3 py-2">Harley Dental Manchester</span>
      </div>
    ),
  },
  {
    title: "Treatment value in pounds",
    body: "When a patient accepts a plan, the team records its value on the lead, stored exactly in pence, ready for revenue reporting.",
    demo: (
      <span className="inline-flex h-10 items-center rounded-md border bg-card px-3 font-mono text-sm tabular-nums">
        <span className="mr-2 text-muted-foreground">£</span>4,500
      </span>
    ),
  },
];

function Built() {
  return (
    <section id="built" aria-labelledby="built-title" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-20 sm:px-8 lg:py-28">
      <h2 id="built-title" className="text-[clamp(1.9rem,3.6vw,2.75rem)] leading-[1.08] font-semibold tracking-[-0.015em]">
        What&apos;s built and running today
      </h2>
      <ul className="perforated-top mt-12">
        {FEATURES.map((f) => (
          <li key={f.title} className="perforated grid items-center gap-5 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
            <div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 max-w-prose text-muted-foreground">{f.body}</p>
            </div>
            <div className="flex min-h-12 items-center md:justify-end">{f.demo}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const PIPE = ["Ad platform", "Signed webhook", "Postgres, unique key", "LISTEN / NOTIFY", "Server-sent events", "Every open board"];

function Technical() {
  return (
    <section aria-label="For the technically curious" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <details className="group perforated-top perforated bg-transparent">
        <summary className="flex cursor-pointer list-none items-center gap-4 rounded-[10px] px-5 py-4 [&::-webkit-details-marker]:hidden">
          <PostmarkMark className="h-5 text-brand" />
          <span className="type-label text-[0.85rem] tracking-[0.06em]">For the technically curious</span>
          <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Open the docket</span>
          <PlusIcon aria-hidden className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-45" />
        </summary>
        <div className="perforated-top px-5 pt-5 pb-6">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
            {PIPE.map((p, i) => (
              <li key={p} className="flex items-center gap-2">
                <span className="rounded-md border bg-surface px-2.5 py-1.5 font-medium">{p}</span>
                {i < PIPE.length - 1 && <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden />}
              </li>
            ))}
          </ol>
          <ul className="mt-5 grid gap-x-10 gap-y-2 text-sm text-muted-foreground md:grid-cols-2">
            <li>HMAC-SHA256 over the raw body, compared in constant time. A bad signature writes nothing.</li>
            <li>Idempotency is a unique key with ON CONFLICT DO NOTHING, so concurrent retries can&apos;t both insert.</li>
            <li>One LISTEN connection per API process fans out to every tab: ten tabs, not ten database connections.</li>
            <li>The request id is the trace id: it is on every API log line and in every response header.</li>
          </ul>
          <p className="mt-5 text-sm text-muted-foreground">
            To watch three deliveries become one lead, open the board and run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">bun run simulate --burst-dupes</code>{" "}
            from the repo root. Design notes live under <code className="font-mono text-xs text-foreground">docs/</code>.
          </p>
        </div>
      </details>
    </section>
  );
}

function Close() {
  return (
    <footer className="bg-rail text-rail-foreground">
      <Band className="h-14" />
      <div className="mx-auto grid max-w-6xl gap-x-8 px-5 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="pt-16 pb-8 md:pb-16 lg:pt-20 lg:pb-20">
          <p className="type-display text-[clamp(2.4rem,6vw,4rem)]">Watch one land.</p>
          <p className="mt-4 max-w-md text-rail-foreground/85">
            The demo board is live with two sample clinics. Open it and see who has waited longest for a call.
          </p>
        </div>
        <div className="self-end pb-16 lg:pb-20">
          <PrimaryCta />
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-rail-muted sm:px-8">
          <span className="inline-flex items-center gap-2">
            <PostmarkMark className="h-4" /> LeadLine, a demo build. All data is synthetic.
          </span>
          <span>Phones use the 07700 900xxx drama range; emails end @example.com.</span>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <>
      <Hero />
      <main>
        <Problem />
        <HowItWorks />
        <Built />
        <Technical />
      </main>
      <Close />
    </>
  );
}
