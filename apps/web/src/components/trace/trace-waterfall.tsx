import type { Trace } from "@leadline/shared";
import { OutcomeStamp } from "@/components/deliveries/outcome-stamp";
import { LANES, laneOf, type Lane } from "@/components/trace/lanes";
import { formatClock, formatDay, formatMs, SOURCE_LABEL, sourceLabel } from "@/lib/format";

/** Span details come from the API verbatim; swap source enums for the words people use. */
const labelSources = (detail: string) =>
  Object.entries(SOURCE_LABEL).reduce((text, [code, label]) => text.replaceAll(code, label), detail);
import { cn } from "@/lib/utils";

/** The trace as a tracking history: two lanes, one shared time axis, response-sent marked. */
export function TraceWaterfall({ trace, waiting }: { trace: Trace; waiting: boolean }) {
  const total = Math.max(...trace.spans.map((s) => s.offsetMs + (s.durationMs ?? 0)), 1);
  const responded = trace.spans.find((s) => s.name.startsWith("response sent"));
  const pct = (ms: number) => `${Math.min(100, (ms / total) * 100)}%`;
  const lanes: Lane[] = ["request", "hub"];

  return (
    <div className="@container">
      {trace.delivery && (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <OutcomeStamp outcome={trace.delivery.outcome} />
          <span className="font-semibold">{trace.delivery.leadName ?? trace.delivery.sourceLeadId ?? "Unnamed lead"}</span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {formatDay(trace.delivery.receivedAt)} · {formatClock(trace.delivery.receivedAt)} · {sourceLabel(trace.delivery.source)}
          </span>
        </div>
      )}
      <ul className="mb-5 flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
        {lanes.map((lane) => (
          <li key={lane} className="flex items-start gap-2 text-xs">
            <span aria-hidden className={cn("mt-1 h-2 w-5 shrink-0 rounded-full", LANES[lane].swatch)} />
            <span>
              <span className="font-semibold">{LANES[lane].label}</span>
              <span className="block text-muted-foreground">{LANES[lane].description}</span>
            </span>
          </li>
        ))}
        <li className="flex items-center gap-3 text-xs text-muted-foreground" aria-label="Marks">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rotate-45 rounded-[1px] bg-muted-foreground" /> instant, “at”
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-4 rounded-[2px] bg-muted-foreground" /> duration, “took”
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-px bg-foreground/40" /> response sent
          </span>
        </li>
      </ul>

      <div role="table" aria-label="Trace spans" className="text-sm">
        <div role="row" className="type-label hidden grid-cols-[minmax(0,1fr)_minmax(9rem,42%)_5.5rem] gap-3 border-b pb-1.5 text-[0.7rem] text-muted-foreground @xl:grid">
          <span role="columnheader">Step</span>
          <span role="columnheader">When, from arrival</span>
          <span role="columnheader" className="text-right">
            Took · at
          </span>
        </div>
        {lanes.map((lane) => {
          const spans = trace.spans.filter((s) => laneOf(s) === lane);
          return (
            <div role="rowgroup" key={lane} className="pt-3">
              <div role="row" className="flex items-center gap-2 pb-1.5">
                <span aria-hidden className={cn("h-2 w-2 rounded-full", LANES[lane].swatch)} />
                <span role="rowheader" className={cn("type-label text-[0.75rem]", LANES[lane].text)}>
                  {LANES[lane].label}
                </span>
              </div>
              {spans.length === 0 && (
                <p role="row" className="py-2 pl-4 text-xs text-muted-foreground">
                  {lane === "hub" && waiting ? (
                    <span className="motion-safe:animate-pulse">Waiting for the hub to report…</span>
                  ) : lane === "hub" ? (
                    "The hub didn't report for this request: it was rejected or nothing was published."
                  ) : (
                    "No request spans."
                  )}
                </p>
              )}
              {spans.map((s, i) => (
                <div
                  role="row"
                  key={`${s.name}-${i}`}
                  className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-x-3 gap-y-1 border-b border-dashed border-border/70 py-2 last:border-b-0 @xl:grid-cols-[minmax(0,1fr)_minmax(9rem,42%)_5.5rem] @xl:items-center"
                >
                  <div role="cell" className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    {s.detail && <p className="truncate text-xs text-muted-foreground">{labelSources(s.detail)}</p>}
                  </div>
                  <div role="cell" className="relative col-span-2 row-start-2 h-3 rounded-sm bg-muted @xl:col-span-1 @xl:row-start-auto">
                    {responded && (
                      <span aria-hidden className="absolute -top-1 -bottom-1 w-px bg-foreground/40" style={{ left: pct(responded.offsetMs) }} />
                    )}
                    {s.durationMs != null ? (
                      <span
                        className={cn("absolute top-0.5 bottom-0.5 rounded-[2px]", LANES[lane].bar)}
                        style={{ left: pct(s.offsetMs), width: `max(${pct(s.durationMs)}, 3px)` }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px]", LANES[lane].bar)}
                        style={{ left: pct(s.offsetMs) }}
                      />
                    )}
                  </div>
                  <div role="cell" className="text-right font-mono text-xs tabular-nums">
                    {s.durationMs != null ? (
                      <span>{formatMs(s.durationMs)}</span>
                    ) : (
                      <span className="text-muted-foreground">at {formatMs(s.offsetMs)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-3 w-px bg-foreground/40" />
          {responded ? `Response sent at ${formatMs(responded.offsetMs)}` : "No response-sent mark yet"}
        </span>
        <span>
          Whole trace <span className="font-mono text-foreground tabular-nums">{formatMs(total)}</span>
        </span>
      </div>
    </div>
  );
}
