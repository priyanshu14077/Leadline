"use client";

import type { DeliveryOutcome, DeliveryRow, StreamMessage } from "@leadline/shared";
import { useMemo, useState } from "react";
import { useStreamMessages } from "@/components/app/live-stream";
import { DeliveryGroups } from "@/components/deliveries/delivery-groups";
import { groupDeliveries } from "@/components/deliveries/group";
import { cn } from "@/lib/utils";

type Filter = "ALL" | DeliveryOutcome;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "CREATED", label: "Created" },
  { id: "DUPLICATE", label: "Duplicate" },
  { id: "REJECTED", label: "Rejected" },
];
const WINDOW = 30;

function PageIntro() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Deliveries</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every webhook request this clinic received, retries included. Ad platforms resend a lead when they don&apos;t get a fast
        answer; the database keeps one lead per platform id, and every attempt is logged here. Open any attempt to trace it.
      </p>
    </div>
  );
}

/** The full delivery log, live. */
export function DeliveriesView({ practiceSlug, deliveries: initial }: { practiceSlug: string; deliveries: DeliveryRow[] }) {
  const [rows, setRows] = useState(initial);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("ALL");

  // Adopt new server data after a resync (router.refresh()).
  const [server, setServer] = useState(initial);
  if (initial !== server) {
    setServer(initial);
    setRows(initial);
  }

  useStreamMessages((msg: StreamMessage) => {
    if (msg.type !== "delivery.logged") return;
    setRows((r) => [msg.delivery, ...r.filter((x) => x.id !== msg.delivery.id)].slice(0, WINDOW));
    setFresh((s) => new Set(s).add(msg.delivery.id));
    setTimeout(
      () =>
        setFresh((s) => {
          const next = new Set(s);
          next.delete(msg.delivery.id);
          return next;
        }),
      4000,
    );
  });

  const groups = useMemo(() => groupDeliveries(rows), [rows]);
  const shown = filter === "ALL" ? groups : groups.filter((g) => g.rows.some((r) => r.outcome === filter));
  const count = (o: DeliveryOutcome) => rows.filter((r) => r.outcome === o).length;
  const merged = groups.filter((g) => g.rows.length > 1).length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 lg:px-6 lg:py-8">
      <PageIntro />

      <p className="mt-5 text-sm">
        <span className="font-mono tabular-nums">{rows.length}</span> requests ·{" "}
        <span className="font-mono tabular-nums">{count("CREATED")}</span> leads created ·{" "}
        <span className="font-mono tabular-nums">{count("DUPLICATE")}</span> duplicates caught ·{" "}
        <span className="font-mono tabular-nums">{merged}</span> leads delivered more than once
      </p>

      <div role="radiogroup" aria-label="Filter by outcome" className="mt-6 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm",
              filter === f.id ? "border-foreground bg-foreground font-medium text-background" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            {f.id !== "ALL" && <span className="font-mono text-xs tabular-nums">{count(f.id)}</span>}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border bg-card">
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No deliveries yet. Send one from the repo root:
            <code className="mx-auto mt-2 block w-fit rounded bg-muted px-2 py-1 font-mono text-foreground">bun run simulate --burst-dupes</code>
          </div>
        ) : shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No {filter.toLowerCase()} deliveries in the last {rows.length}.</p>
        ) : (
          <DeliveryGroups groups={shown} freshIds={fresh} action={{ kind: "link", href: (id) => `/app/${practiceSlug}/deliveries/${id}` }} />
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Showing the latest {WINDOW} requests.</p>
    </div>
  );
}

export function DeliveriesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 lg:px-6 lg:py-8" aria-label="Loading deliveries">
      <PageIntro />
      <div className="mt-5 h-5 w-96 max-w-full rounded bg-surface motion-safe:animate-pulse" />
      <div className="mt-6 h-8 w-80 max-w-full rounded-full bg-surface" />
      <div className="mt-3 space-y-px overflow-hidden rounded-xl border bg-card">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2 px-4 py-4">
            <div className="h-4 w-48 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-72 max-w-full rounded bg-muted motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
