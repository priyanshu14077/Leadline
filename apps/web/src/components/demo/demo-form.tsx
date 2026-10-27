"use client";

import type { DemoLeadResult } from "@leadline/shared";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, browserApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export type ClinicOption = { slug: string; name: string; campaigns: { utmCampaign: string; name: string }[] };

// Synthetic people only: Ofcom's drama phone range and @example.com, like the seed.
const SAMPLES = [
  { name: "Isla Whitfield", phone: "07700 900417", message: "Getting married in three weeks and I'd love whiter teeth for the photos. Is there time?" },
  { name: "Callum Reid", phone: "07700 900582", message: "Lost a front tooth playing football on Sunday. Do you do implants and can I come in this week?" },
  { name: "Priya Shah", phone: "07700 900233", message: "How much is Invisalign? I'm quite nervous about dentists so I'd like to know what's involved first." },
  { name: "Ellie Morgan", phone: "07700 900761", message: "Can you send before and after photos of your veneers? My last clinic's work looked really fake." },
];

const field = "w-full rounded-lg border border-input bg-card px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

type Sent = DemoLeadResult & { slug: string; name: string };

/** A stand-in for an ad platform's lead form. The API signs what it sends; this page holds no secret. */
export function DemoForm({ clinics, defaultSlug }: { clinics: ClinicOption[]; defaultSlug?: string }) {
  const [slug, setSlug] = useState((clinics.find((c) => c.slug === defaultSlug) ?? clinics[0])?.slug ?? "");
  const clinic = clinics.find((c) => c.slug === slug);
  const [campaign, setCampaign] = useState(clinic?.campaigns[0]?.utmCampaign ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [retries, setRetries] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [pending, start] = useTransition();

  function pickClinic(next: string) {
    setSlug(next);
    setCampaign(clinics.find((c) => c.slug === next)?.campaigns[0]?.utmCampaign ?? "");
  }

  function fillSample() {
    const s = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
    const [first, last] = s.name.toLowerCase().split(" ");
    setName(s.name);
    setPhone(s.phone);
    setEmail(`${first}.${last}@example.com`);
    setMessage(s.message);
    setErrors({});
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = "Enter a name";
    if (!message.trim()) local.message = "Enter the enquiry";
    setErrors(local);
    if (Object.keys(local).length) return;

    start(async () => {
      try {
        const result = await browserApi.demoLead({
          practice: slug,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          message: message.trim(),
          campaign: campaign || undefined,
          deliveries: retries ? 3 : 1,
        });
        setSent({ ...result, slug, name: name.trim() });
        setName("");
        setEmail("");
        setPhone("");
        setMessage("");
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        const fromApi = Object.fromEntries(err.issues.map((i) => [String(i.path[0]), i.message]));
        setErrors(fromApi);
        setProblem(
          err.status === 0
            ? "LeadLine's API isn't reachable. Is `bun run dev` running?"
            : err.issues.length
              ? "Check the highlighted fields."
              : `The lead wasn't sent: ${err.detail}${err.requestId ? ` (request ${err.requestId})` : ""}.`,
        );
      }
    });
  }

  if (!clinics.length) return <p className="text-muted-foreground">No clinics found. Seed the database with `bun run db:seed`.</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-12">
      <form onSubmit={submit} noValidate className="rounded-xl border bg-card p-5 shadow-[0_18px_40px_-28px_oklch(0.25_0.1_262/0.45)]">
        <p className="type-label text-[0.72rem] text-muted-foreground">Sponsored · Lead form</p>
        <h2 className="mt-1 text-lg font-semibold">Book a free smile consultation</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tell us what you&apos;re looking for and the clinic will call you back.</p>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="clinic">Clinic</Label>
              <select id="clinic" value={slug} onChange={(e) => pickClinic(e.target.value)} className={field}>
                {clinics.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="campaign">Ad campaign</Label>
              <select id="campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} className={field}>
                {clinic?.campaigns.map((c) => (
                  <option key={c.utmCampaign} value={c.utmCampaign}>
                    {c.name}
                  </option>
                ))}
                <option value="">No campaign tag</option>
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} className="h-9" />
            {errors.name && <p id="name-error" className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" aria-invalid={!!errors.email} className="h-9" />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" className="h-9 font-mono" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="message">What would you like help with?</Label>
            <textarea
              id="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? "message-error" : undefined}
              className={cn(field, "resize-y")}
            />
            {errors.message && <p id="message-error" className="text-xs text-destructive">{errors.message}</p>}
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-dashed p-3 text-sm">
            <input type="checkbox" checked={retries} onChange={(e) => setRetries(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand)]" />
            <span>
              <span className="font-medium">Deliver it 3 times</span>
              <span className="block text-muted-foreground">Like an ad platform retrying when it doesn&apos;t hear back fast enough.</span>
            </span>
          </label>
        </div>

        {problem && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {problem}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending} className="h-9">
            {pending ? "Sending…" : "Submit"}
          </Button>
          <Button type="button" variant="outline" onClick={fillSample} className="h-9">
            Fill with a sample
          </Button>
        </div>
      </form>

      <Result sent={sent} />
    </div>
  );
}

function Result({ sent }: { sent: Sent | null }) {
  if (!sent) {
    return (
      <div className="self-start text-sm text-muted-foreground">
        <p className="type-label text-[0.72rem]">What happens</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>The API signs the form with the clinic&apos;s webhook secret, as the ad platform would.</li>
          <li>The signed lead goes through the real webhook: signature check, one lead per platform id, delivery log.</li>
          <li>The card lands on every open board for that clinic.</li>
          <li>Gemini reads the enquiry and the card updates by itself.</li>
        </ol>
        <p className="mt-4">Keep the pipeline open in another window to watch it arrive.</p>
      </div>
    );
  }
  const created = sent.deliveries.filter((d) => !d.duplicate).length;
  return (
    <div role="status" className="self-start rounded-xl border bg-card p-5">
      <p className="type-label text-[0.72rem] text-muted-foreground">Sent</p>
      <p className="mt-1 text-lg font-semibold">
        {sent.name}&apos;s enquiry: {sent.deliveries.length} {sent.deliveries.length === 1 ? "delivery" : "deliveries"} → {created} lead
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {sent.deliveries.map((d, i) => (
          <li key={d.traceId} className="flex items-center gap-2">
            <span className="w-24 text-muted-foreground">Delivery {i + 1}</span>
            <span className={cn("type-label rounded-sm border px-1 text-[0.7rem]", d.duplicate ? "text-muted-foreground" : "border-brand text-brand")}>
              {d.duplicate ? "Duplicate" : "Created"}
            </span>
            <Link href={`/app/${sent.slug}/deliveries/${d.traceId}`} className="ml-auto text-brand underline-offset-4 hover:underline">
              Trace
            </Link>
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" className="mt-4 h-9">
        <Link href={`/app/${sent.slug}/pipeline`}>Open the pipeline</Link>
      </Button>
    </div>
  );
}
