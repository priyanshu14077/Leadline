"use client";

import type { Trace } from "@leadline/shared";
import { useEffect, useState } from "react";
import { ApiError, browserApi } from "@/lib/api";
import { hubComplete } from "@/components/trace/lanes";

// Spans are written after the webhook responds, and the hub adds its own a moment later.
// So a fresh trace may 404 or lack the hub lane: look again on this schedule before giving up.
const SCHEDULE_MS = [500, 1500, 3000];

export type TraceState =
  | { status: "loading" }
  | { status: "ready"; trace: Trace; waiting: boolean }
  | { status: "missing" }
  | { status: "error"; error: ApiError | null };

export function useTrace(practiceSlug: string, traceId: string | null, initial?: Trace) {
  const [state, setState] = useState<TraceState>(initial ? { status: "ready", trace: initial, waiting: !hubComplete(initial) } : { status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!traceId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const done = initial && hubComplete(initial) && nonce === 0;
    if (done) return;

    const load = async () => {
      try {
        const trace = await browserApi.trace(practiceSlug, traceId);
        if (cancelled) return;
        const complete = hubComplete(trace);
        const more = !complete && attempt < SCHEDULE_MS.length;
        setState({ status: "ready", trace, waiting: more });
        if (more) timer = setTimeout(load, SCHEDULE_MS[attempt++]);
      } catch (e) {
        if (cancelled) return;
        const err = e instanceof ApiError ? e : null;
        if (err?.status === 404) {
          if (attempt < SCHEDULE_MS.length) {
            timer = setTimeout(load, SCHEDULE_MS[attempt++]);
          } else {
            setState({ status: "missing" });
          }
          return;
        }
        setState({ status: "error", error: err });
      }
    };
    timer = setTimeout(load, initial && nonce === 0 ? SCHEDULE_MS[attempt++] : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [practiceSlug, traceId, initial, nonce]);

  const retry = () => {
    setState({ status: "loading" });
    setNonce((n) => n + 1);
  };
  return [state, retry] as const;
}
