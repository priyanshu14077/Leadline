import type { LeadSource, Objection, Stage, Treatment, Urgency } from "@leadline/shared";

export const BOARD_STAGES = ["NEW", "CONTACTED", "CONSULT_BOOKED", "TREATMENT_ACCEPTED"] as const satisfies Stage[];

export const STAGE_LABEL: Record<Stage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CONSULT_BOOKED: "Consult booked",
  TREATMENT_ACCEPTED: "Treatment accepted",
  LOST: "Lost",
};

export const TREATMENT_LABEL: Record<Treatment, string> = {
  IMPLANTS: "Implants",
  INVISALIGN: "Invisalign",
  VENEERS: "Veneers",
  WHITENING: "Whitening",
  COMPOSITE_BONDING: "Composite bonding",
  OTHER: "Other",
};

export const URGENCY_LABEL: Record<Urgency, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

export const OBJECTION_LABEL: Record<Objection, string> = {
  PRICE: "Price",
  FEAR: "Nervous",
  TIME: "Timing",
  TRUST: "Trust",
  OTHER: "Other",
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  META_LEAD_ADS: "Meta lead ad",
  GOOGLE_LEAD_FORM: "Google lead form",
  WEBSITE: "Website",
};

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
export const formatGBP = (pence: number) => gbp.format(pence / 100);

/** 0:42, 4:05, 39m, 1h 12m, 3d 4h: to the second while it matters, coarse once the lead is cold. */
export function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600);
  if (h < 24) return `${h}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// Practices are UK clinics: show London time whatever the viewer's machine is set to.
// Fixed zone also keeps server HTML and hydration identical.
const TZ = "Europe/London";

const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const formatClock = (iso: string) => time.format(new Date(iso));

const dateTime = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

export const PLATFORM_LABEL = { META: "Meta", GOOGLE: "Google", TIKTOK: "TikTok" } as const;

/** Speed-to-lead bands. Green under 3 min, amber under 5, red from 5, critical from an hour. */
export const AMBER_MS = 3 * 60_000;
export const RED_MS = 5 * 60_000;
export const CRITICAL_MS = 60 * 60_000;
export type TimerTone = "ok" | "warn" | "overdue" | "critical";
export function timerTone(waitingMs: number): TimerTone {
  if (waitingMs < AMBER_MS) return "ok";
  if (waitingMs < RED_MS) return "warn";
  if (waitingMs < CRITICAL_MS) return "overdue";
  return "critical";
}

/** "22 seconds", "4 minutes 5 seconds", "1 hour 12 minutes": for screen readers. */
export function spokenElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (s < 60) return part(s, "second");
  if (s < 3600) return `${part(Math.floor(s / 60), "minute")}${s % 60 && s < 600 ? ` ${part(s % 60, "second")}` : ""}`;
  const h = Math.floor(s / 3600);
  if (h < 24) return `${part(h, "hour")} ${part(Math.floor((s % 3600) / 60), "minute")}`;
  return `${part(Math.floor(h / 24), "day")} ${part(h % 24, "hour")}`;
}

const day = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
export const formatDay = (iso: string) => day.format(new Date(iso));

/** 4.2 ms, 18 ms, 1,204 ms. */
export const formatMs = (n: number) => (n < 10 ? `${n.toFixed(1)} ms` : `${Math.round(n).toLocaleString("en-GB")} ms`);

const dayShort = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
export const formatDayShort = (iso: string) => dayShort.format(new Date(iso));

/** Delivery source as people say it; unknown values (rejected junk) stay as sent. */
export const sourceLabel = (source: string) => (source in SOURCE_LABEL ? SOURCE_LABEL[source as LeadSource] : source);
