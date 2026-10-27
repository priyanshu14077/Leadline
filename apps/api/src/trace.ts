import { performance } from "node:perf_hooks";
import type { TraceSpan } from "@leadline/shared";
import { prisma } from "./db";

/**
 * Times the steps of one webhook request. Spans stay in memory and are written in one insert
 * after the response is sent (see routes/webhooks.ts), so tracing never delays the 200.
 */
export class RequestTrace {
  readonly spans: TraceSpan[] = [];
  /** Epoch ms at arrival. Travels in the NOTIFY payload so other processes can place their spans. */
  readonly startedAt: number;
  private readonly t0: number;
  practiceId: string | null = null;

  /** Pass startedAt to continue an existing trace (work after the response), keeping its clock. */
  constructor(
    readonly traceId: string,
    startedAt = Date.now(),
  ) {
    this.startedAt = startedAt;
    this.t0 = performance.now() - (Date.now() - startedAt);
  }

  mark(name: string, detail?: string) {
    this.spans.push({ name, offsetMs: performance.now() - this.t0, durationMs: null, detail: detail ?? null });
  }

  async time<T>(name: string, fn: () => Promise<T>, detail?: (result: T) => string | undefined): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    this.spans.push({ name, offsetMs: start - this.t0, durationMs: end - start, detail: detail?.(result) ?? null });
    return result;
  }
}

/** For code paths that can run without a request (tests, scripts). */
export const NO_TRACE = {
  traceId: undefined,
  startedAt: undefined,
  mark() {},
  time<T>(_name: string, fn: () => Promise<T>) {
    return fn();
  },
};

export type Tracer = Pick<RequestTrace, "mark" | "time"> & { traceId?: string; startedAt?: number };

export async function saveSpans(practiceId: string, traceId: string, spans: TraceSpan[]) {
  if (!spans.length) return;
  await prisma.traceSpan.createMany({ data: spans.map((s) => ({ ...s, practiceId, traceId })) });
}
