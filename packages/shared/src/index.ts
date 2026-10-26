// The contract between apps/api and apps/web. The API's Prisma rows must be assignable to these
// types, so a schema change that breaks the UI fails typecheck in the API, not at runtime.
import { z } from "zod";

export const STAGES = ["NEW", "CONTACTED", "CONSULT_BOOKED", "TREATMENT_ACCEPTED", "LOST"] as const;
export type Stage = (typeof STAGES)[number];

export const LEAD_SOURCES = ["META_LEAD_ADS", "GOOGLE_LEAD_FORM", "WEBSITE"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const TREATMENTS = ["IMPLANTS", "INVISALIGN", "VENEERS", "WHITENING", "COMPOSITE_BONDING", "OTHER"] as const;
export type Treatment = (typeof TREATMENTS)[number];

export const URGENCIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const OBJECTIONS = ["PRICE", "FEAR", "TIME", "TRUST", "OTHER"] as const;
export type Objection = (typeof OBJECTIONS)[number];

export type TriageStatus = "PENDING" | "DONE" | "FAILED";
export type DeliveryOutcome = "CREATED" | "DUPLICATE" | "REJECTED";
export type Platform = "META" | "GOOGLE" | "TIKTOK";

/** The webhook body ad platforms (and the simulator) send. */
export const leadPayload = z.object({
  source: z.enum(LEAD_SOURCES),
  sourceLeadId: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  email: z.email().optional(),
  phone: z.string().max(40).optional(),
  message: z.string().trim().min(1).max(5000),
  utm: z
    .object({
      source: z.string().max(100).optional(),
      medium: z.string().max(100).optional(),
      campaign: z.string().max(200).optional(),
    })
    .optional(),
});
export type LeadPayload = z.infer<typeof leadPayload>;

export const moveLeadBody = z.object({ stage: z.enum(STAGES) });
// Pounds as typed by a person; null clears the value.
export const treatmentValueBody = z.object({ pounds: z.number().min(0).max(250_000).nullable() });

export type Practice = { id: string; slug: string; name: string };

/** JSON-safe card: dates as ISO strings, so it crosses HTTP and SSE unchanged. */
export type LeadCard = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  source: LeadSource;
  utmCampaign: string | null;
  campaign: { name: string; platform: Platform } | null;
  stage: Stage;
  receivedAt: string;
  firstContactedAt: string | null;
  consultBookedAt: string | null;
  treatmentAcceptedAt: string | null;
  treatmentValuePence: number | null;
  triageStatus: TriageStatus;
  treatmentInterest: Treatment | null;
  urgency: Urgency | null;
  objections: Objection[];
  triageOpener: string | null;
};

export type DeliveryRow = {
  id: string;
  traceId: string | null;
  source: string;
  sourceLeadId: string | null;
  outcome: DeliveryOutcome;
  receivedAt: string;
  leadName: string | null;
};

export type Board = { leads: LeadCard[]; lostCount: number; deliveries: DeliveryRow[] };

/** What the browser receives over SSE: events resolved to full data on the server. */
export type StreamMessage =
  | { type: "lead.created" | "lead.updated"; traceId?: string; lead: LeadCard }
  | { type: "delivery.logged"; traceId?: string; delivery: DeliveryRow };

export type TraceSpan = {
  name: string;
  offsetMs: number;
  durationMs: number | null;
  detail: string | null;
};

export type Trace = { traceId: string; delivery: DeliveryRow | null; spans: TraceSpan[] };
