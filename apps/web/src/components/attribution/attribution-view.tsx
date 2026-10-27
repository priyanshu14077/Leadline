"use client";

import type { Attribution, CampaignAttribution } from "@leadline/shared";
import { useRef, useState } from "react";
import { useStreamMessages } from "@/components/app/live-stream";
import { browserApi } from "@/lib/api";
import { PLATFORM_LABEL, formatGBP, formatGBPExact } from "@/lib/format";
import { cn } from "@/lib/utils";

const REFETCH_DEBOUNCE_MS = 600;

function PageIntro() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Attribution</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ad platforms report cost per form fill. A clinic is paid by booked consults and accepted plans, so this page follows each
        campaign&apos;s leads all the way to treatment value. A lead counts at every stage it ever reached: a consult that was
        booked and later lost still counts as booked.
      </p>
    </div>
  );
}

const money = (pence: number | null) => (pence === null ? "–" : formatGBP(pence));

function Stat({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className={cn("min-w-0 px-4 py-3", className)}>
      <dt className="type-label text-[0.72rem] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-xl tabular-nums">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

/** Return per £1 as a bar against the best campaign, with a tick at £1 (break-even). */
function ReturnBar({ value, max }: { value: number | null; max: number }) {
  if (value === null) return <span className="text-sm text-muted-foreground">No spend</span>;
  const scale = Math.max(max, 1);
  return (
    <span className="flex items-center justify-end gap-2.5">
      <span aria-hidden className="relative hidden h-2 w-24 rounded-sm bg-surface sm:block">
        <span className="absolute inset-y-0 left-0 rounded-[2px] bg-brand" style={{ width: `${Math.min(value / scale, 1) * 100}%` }} />
        <span className="absolute -inset-y-0.5 w-px bg-foreground/60" style={{ left: `${(1 / scale) * 100}%` }} />
      </span>
      <span className={cn("font-mono tabular-nums", value >= 1 ? "font-semibold" : "text-muted-foreground")}>{formatGBPExact(value)}</span>
    </span>
  );
}

function CampaignRow({ c, max }: { c: CampaignAttribution; max: number }) {
  const losing = c.valuePerPound !== null && c.valuePerPound < 1 && c.spendPence > 0;
  return (
    <tr className="perforated align-top">
      <th scope="row" className="py-3 pr-4 text-left font-normal">
        <span className="block font-semibold">{c.name}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="type-label text-[0.7rem] text-foreground/70">{PLATFORM_LABEL[c.platform]}</span>
          <span className="truncate font-mono">{c.utmCampaign}</span>
        </span>
        {losing && <span className="mt-1 block text-xs text-muted-foreground">Returns less than it costs</span>}
      </th>
      <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatGBP(c.spendPence)}</td>
      <td className="py-3 pr-4 text-right font-mono tabular-nums">{c.leads}</td>
      <td className="py-3 pr-4 text-right font-mono tabular-nums">{c.consultsBooked}</td>
      <td className="py-3 pr-4 text-right font-mono tabular-nums">
        {c.treatmentsAccepted}
        {c.acceptedWithoutValue > 0 && (
          <span className="block text-xs text-muted-foreground" title="Accepted plans with no value entered yet">
            {c.acceptedWithoutValue} unvalued
          </span>
        )}
      </td>
      <td className="py-3 pr-4 text-right font-mono tabular-nums">{formatGBP(c.revenuePence)}</td>
      <td className="py-3 pr-4 text-right font-mono tabular-nums">{c.costPerConsultPence === null ? "None booked" : money(c.costPerConsultPence)}</td>
      <td className="py-3 text-right">
        <ReturnBar value={c.valuePerPound} max={max} />
      </td>
    </tr>
  );
}

/** Phone layout: one card per campaign, the return first. */
function CampaignCard({ c, max }: { c: CampaignAttribution; max: number }) {
  const losing = c.valuePerPound !== null && c.valuePerPound < 1 && c.spendPence > 0;
  const cell = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="type-label text-[0.68rem] text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
  return (
    <li className="perforated py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{c.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="type-label text-[0.7rem] text-foreground/70">{PLATFORM_LABEL[c.platform]}</span>
            {losing && <span className="ml-2">Returns less than it costs</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="type-label text-[0.68rem] text-muted-foreground">Back per £1</p>
          <ReturnBar value={c.valuePerPound} max={max} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
        {cell("Spend", formatGBP(c.spendPence))}
        {cell("Leads", c.leads)}
        {cell("Booked", c.consultsBooked)}
        {cell("Accepted", `${c.treatmentsAccepted}${c.acceptedWithoutValue ? ` (${c.acceptedWithoutValue} unvalued)` : ""}`)}
        {cell("Value", formatGBP(c.revenuePence))}
        {cell("Per consult", c.costPerConsultPence === null ? "–" : money(c.costPerConsultPence))}
      </dl>
    </li>
  );
}

/** Campaign money, refetched whenever the live stream reports a lead change. */
export function AttributionView({ practiceSlug, attribution: initial }: { practiceSlug: string; attribution: Attribution }) {
  const [data, setData] = useState(initial);
  const [stale, setStale] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Adopt new server data after a resync (router.refresh()).
  const [server, setServer] = useState(initial);
  if (initial !== server) {
    setServer(initial);
    setData(initial);
  }

  // A burst of events (a sweep, a drag) becomes one refetch.
  useStreamMessages((msg) => {
    if (msg.type === "delivery.logged") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      browserApi
        .attribution(practiceSlug)
        .then((next) => {
          setData(next);
          setStale(false);
        })
        .catch(() => setStale(true));
    }, REFETCH_DEBOUNCE_MS);
  });

  const { campaigns, totals, unattributedLeads } = data;
  const max = Math.max(0, ...campaigns.map((c) => c.valuePerPound ?? 0));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-6 lg:py-8">
      <PageIntro />

      <dl className="mt-6 grid grid-cols-2 divide-x divide-y rounded-xl border bg-card sm:grid-cols-5 sm:divide-y-0">
        <Stat label="Ad spend" value={formatGBP(totals.spendPence)} />
        <Stat label="Booked consults" value={String(totals.consultsBooked)} hint={`from ${totals.leads} leads`} />
        <Stat label="Cost per consult" value={money(totals.costPerConsultPence)} />
        <Stat label="Accepted value" value={formatGBP(totals.revenuePence)} hint={`${totals.treatmentsAccepted} plans`} />
        <Stat
          label="Back per £1"
          value={totals.valuePerPound === null ? "–" : formatGBPExact(totals.valuePerPound)}
          className="col-span-2 sm:col-span-1"
        />
      </dl>

      {stale && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Couldn&apos;t refresh these numbers. They&apos;ll update with the next change.
        </p>
      )}

      {campaigns.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No campaigns yet. A campaign appears here with its first lead.</p>
      ) : (
        <>
          <ul className="perforated-top mt-8 md:hidden">
            {campaigns.map((c) => (
              <CampaignCard key={c.campaignId} c={c} max={max} />
            ))}
          </ul>
          <div className="mt-8 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[48rem] text-sm">
              <caption className="sr-only">Funnel and return for each campaign, highest accepted value first</caption>
              <thead>
                <tr className="type-label perforated text-[0.72rem] text-muted-foreground">
                  <th scope="col" className="pb-2 pr-4 text-left font-normal">Campaign</th>
                  <th scope="col" className="pb-2 pr-4 text-right font-normal">Spend</th>
                  <th scope="col" className="pb-2 pr-4 text-right font-normal">Leads</th>
                  <th scope="col" className="pb-2 pr-4 text-right font-normal">Booked</th>
                  <th scope="col" className="pb-2 pr-4 text-right font-normal">Accepted</th>
                  <th scope="col" className="pb-2 pr-4 text-right font-normal">Value</th>
                  <th scope="col" className="pb-2 pr-4 text-right font-normal">Cost per consult</th>
                  <th scope="col" className="pb-2 text-right font-normal">Back per £1</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <CampaignRow key={c.campaignId} c={c} max={max} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ul className="mt-6 space-y-1 text-xs text-muted-foreground">
        <li className="hidden md:list-item">The tick on each bar is £1 back per £1 spent: break-even on ad spend alone.</li>
        {totals.acceptedWithoutValue > 0 && (
          <li>
            {totals.acceptedWithoutValue} accepted plan{totals.acceptedWithoutValue === 1 ? " has" : "s have"} no value yet, so value is
            understated. Add it in the lead drawer.
          </li>
        )}
        {unattributedLeads > 0 && (
          <li>
            {unattributedLeads} lead{unattributedLeads === 1 ? "" : "s"} arrived without a campaign tag and {unattributedLeads === 1 ? "isn't" : "aren't"} counted
            here.
          </li>
        )}
      </ul>
    </div>
  );
}

export function AttributionSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-6 lg:py-8" aria-busy="true" aria-label="Loading attribution">
      <PageIntro />
      <div className="mt-6 h-[5.5rem] animate-pulse rounded-xl border bg-card motion-reduce:animate-none" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-surface motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
