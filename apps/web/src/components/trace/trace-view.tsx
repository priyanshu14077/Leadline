"use client";

import type { Trace } from "@leadline/shared";
import { Button } from "@/components/ui/button";
import { RequestId } from "@/components/app/problem";
import { TraceWaterfall } from "@/components/trace/trace-waterfall";
import { useTrace } from "@/components/trace/use-trace";

/** Loads (and if needed waits for) a trace, then draws it. Used by the trace page and the sheet. */
export function TraceBody({ practiceSlug, traceId, initial }: { practiceSlug: string; traceId: string; initial?: Trace }) {
  const [state, retry] = useTrace(practiceSlug, traceId, initial);

  if (state.status === "loading") {
    return (
      <div aria-label="Loading trace" className="space-y-3">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="h-3.5 w-40 rounded bg-muted motion-safe:animate-pulse" />
            <span className="h-2.5 flex-1 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        ))}
        <p className="pt-1 text-xs text-muted-foreground">Fetching the trace. A brand-new request takes a moment to be written.</p>
      </div>
    );
  }
  if (state.status === "missing") {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm">
        <p className="font-medium">No trace recorded for this request</p>
        <p className="mt-1 text-muted-foreground">
          LeadLine looked for it four times over three seconds. Requests rejected for a bad signature leave log lines only.
        </p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="rounded-lg border border-overdue/40 bg-overdue-soft/40 p-4 text-sm">
        <p className="font-medium">Couldn&apos;t load the trace</p>
        <p className="mt-1 text-muted-foreground">
          {state.error?.status === 0 ? "LeadLine can't reach the server." : `The server answered HTTP ${state.error?.status ?? "error"}.`}
        </p>
        {state.error?.requestId && <RequestId id={state.error.requestId} className="mt-2" />}
        <Button className="mt-3" size="sm" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }
  return <TraceWaterfall trace={state.trace} waiting={state.waiting} />;
}
