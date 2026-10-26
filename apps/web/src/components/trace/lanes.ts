import type { Trace, TraceSpan } from "@leadline/shared";

export type Lane = "request" | "hub";

const HUB_PREFIXES = ["NOTIFY received", "loaded once", "SSE push", "no open streams"];

/** Which process did the step: the webhook request handler, or the LISTEN hub fanning the event out. */
export const laneOf = (span: TraceSpan): Lane => (HUB_PREFIXES.some((p) => span.name.startsWith(p)) ? "hub" : "request");

/** The hub has finished once it pushed to the open streams, or found none. */
export const hubComplete = (trace: Trace) => trace.spans.some((s) => s.name.startsWith("SSE push") || s.name.startsWith("no open streams"));

export const LANES: Record<Lane, { label: string; description: string; bar: string; swatch: string; text: string }> = {
  request: {
    label: "Webhook request",
    description: "The API handler: verify, store once, respond.",
    bar: "bg-brand",
    swatch: "bg-brand",
    text: "text-brand",
  },
  hub: {
    label: "LISTEN hub",
    description: "After NOTIFY: load the lead once, push it to every open tab.",
    bar: "bg-hub",
    swatch: "bg-hub",
    text: "text-hub",
  },
};
