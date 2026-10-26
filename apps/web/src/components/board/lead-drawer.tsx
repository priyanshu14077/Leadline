"use client";

import type { LeadCard, Stage } from "@leadline/shared";
import { MailIcon, PhoneIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SpeedTimer } from "@/components/board/speed-timer";
import { StageDot, STAGE_ORDER } from "@/components/board/stage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiError, browserApi } from "@/lib/api";
import {
  formatDateTime,
  formatElapsed,
  formatGBP,
  OBJECTION_LABEL,
  SOURCE_LABEL,
  STAGE_LABEL,
  TREATMENT_LABEL,
  URGENCY_LABEL,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_POUNDS = 250_000;

type Props = {
  practiceSlug: string;
  lead: LeadCard | null;
  onClose: () => void;
  onSaved: (lead: LeadCard) => void;
  onMove: (lead: LeadCard, to: Stage) => void;
};

export function LeadDrawer({ practiceSlug, lead, onClose, onSaved, onMove }: Props) {
  return (
    <Sheet open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md [&_[data-slot=sheet-close]]:size-11 [&_[data-slot=sheet-close]]:top-2 [&_[data-slot=sheet-close]]:right-2">
        {lead && (
          <DrawerBody key={lead.id} practiceSlug={practiceSlug} lead={lead} onSaved={onSaved} onMove={onMove} onClose={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h3 className="type-label mb-2 text-[0.72rem] text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function DrawerBody({ practiceSlug, lead, onSaved, onMove, onClose }: Omit<Props, "lead"> & { lead: LeadCard }) {
  return (
    <>
      <SheetHeader className="gap-2 border-b px-5 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3 pr-10">
          <SheetTitle className="text-xl font-semibold">{lead.name}</SheetTitle>
          <SpeedTimer lead={lead} />
        </div>
        <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <StageDot stage={lead.stage} />
            {STAGE_LABEL[lead.stage]}
          </span>
          <span aria-hidden>·</span>
          <span>{SOURCE_LABEL[lead.source]}</span>
          {lead.campaign && (
            <>
              <span aria-hidden>·</span>
              <span>{lead.campaign.name}</span>
            </>
          )}
        </SheetDescription>
        <div className="mt-2 flex flex-wrap gap-2">
          {lead.phone ? (
            <Button asChild size="lg" className="h-10 px-4">
              <a href={`tel:${lead.phone.replace(/\s+/g, "")}`}>
                <PhoneIcon aria-hidden />
                Call <span className="font-mono tabular-nums">{lead.phone}</span>
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">No phone given.</p>
          )}
          {lead.email ? (
            <Button asChild variant="outline" size="lg" className="h-10 px-3">
              <a href={`mailto:${lead.email}`}>
                <MailIcon aria-hidden />
                <span className="max-w-48 truncate">{lead.email}</span>
              </a>
            </Button>
          ) : (
            <p className="self-center text-sm text-muted-foreground">No email given.</p>
          )}
        </div>
      </SheetHeader>

      <div className="space-y-7 px-5 py-5">
        <Section title="Move to">
          <div role="radiogroup" aria-label={`Stage for ${lead.name}`} className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {STAGE_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={lead.stage === s}
                onClick={() => {
                  if (s === lead.stage) return;
                  onMove(lead, s);
                  if (s === "LOST") onClose();
                }}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-md border px-2.5 text-left text-sm transition-colors",
                  lead.stage === s ? "border-foreground bg-foreground font-medium text-background" : "bg-card hover:bg-muted",
                )}
              >
                <StageDot stage={s} />
                {STAGE_LABEL[s]}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Enquiry">
          <p className="rounded-lg bg-surface px-3.5 py-3 text-[0.95rem] leading-relaxed text-pretty">{lead.message}</p>
        </Section>

        <Triage lead={lead} />
        <Timeline lead={lead} />
        <TreatmentValue key={`${lead.id}`} practiceSlug={practiceSlug} lead={lead} onSaved={onSaved} onGone={onClose} />
      </div>
    </>
  );
}

function Triage({ lead }: { lead: LeadCard }) {
  if (lead.triageStatus !== "DONE") {
    return (
      <Section title="AI triage">
        <div className="rounded-lg border border-dashed px-3.5 py-3 text-sm">
          <p className="font-medium">
            Not triaged yet <span className="type-label ml-1 rounded-sm border px-1 text-[0.65rem] text-muted-foreground">Coming next</span>
          </p>
          <p className="mt-1 text-muted-foreground">
            When triage is built, it will read the enquiry and suggest the treatment, urgency, likely concerns and an opening
            line for the call.
          </p>
        </div>
      </Section>
    );
  }
  return (
    <Section title="AI triage">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Wants</dt>
        <dd className="font-medium">{lead.treatmentInterest ? TREATMENT_LABEL[lead.treatmentInterest] : "Unclear"}</dd>
        <dt className="text-muted-foreground">Urgency</dt>
        <dd>{lead.urgency ? URGENCY_LABEL[lead.urgency] : "Unclear"}</dd>
        <dt className="text-muted-foreground">Concerns</dt>
        <dd>{lead.objections.length ? lead.objections.map((o) => OBJECTION_LABEL[o]).join(", ") : "None mentioned"}</dd>
      </dl>
      {lead.triageOpener && (
        <div className="mt-3 rounded-lg bg-brand-soft p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Open the call with</p>
          <p className="text-sm">“{lead.triageOpener}”</p>
        </div>
      )}
    </Section>
  );
}

/** Tracking history of the lead itself: when each stage was first reached. */
function Timeline({ lead }: { lead: LeadCard }) {
  const received = Date.parse(lead.receivedAt);
  const steps = [
    { label: "Received", at: lead.receivedAt },
    { label: "First contact", at: lead.firstContactedAt },
    { label: "Consult booked", at: lead.consultBookedAt },
    { label: "Treatment accepted", at: lead.treatmentAcceptedAt },
  ];
  return (
    <Section title="Timeline">
      <ol className="relative space-y-2.5 text-sm before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-border">
        {steps.map((s) => (
          <li key={s.label} className="relative flex items-baseline justify-between gap-4 pl-6">
            <span
              aria-hidden
              className={cn("absolute top-1.5 left-0 size-[11px] rounded-full border-2", s.at ? "border-brand bg-brand" : "border-border bg-background")}
            />
            <span className={s.at ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
              {s.at ? (
                <>
                  {formatDateTime(s.at)}
                  {s.label !== "Received" && <span className="ml-1.5 text-foreground">+{formatElapsed(Date.parse(s.at) - received)}</span>}
                </>
              ) : (
                "Not yet"
              )}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function TreatmentValue({
  practiceSlug,
  lead,
  onSaved,
  onGone,
}: {
  practiceSlug: string;
  lead: LeadCard;
  onSaved: (l: LeadCard) => void;
  onGone: () => void;
}) {
  const fromLead = lead.treatmentValuePence != null ? String(lead.treatmentValuePence / 100) : "";
  const [draft, setDraft] = useState<string | null>(null); // null = not edited: follow the live value
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const value = draft ?? fromLead;

  const validate = (raw: string): { pounds: number | null } | { error: string } => {
    const clean = raw.replace(/[£,\s]/g, "");
    if (clean === "") return { pounds: null };
    const n = Number(clean);
    if (!Number.isFinite(n)) return { error: "Enter an amount in pounds, for example 4500." };
    if (n < 0) return { error: "The value can't be negative." };
    if (n > MAX_POUNDS) return { error: "The most LeadLine records is £250,000." };
    return { pounds: n };
  };

  const save = () => {
    const result = validate(value);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const saved = await browserApi.setTreatmentValue(practiceSlug, lead.id, result.pounds);
        onSaved(saved);
        setDraft(null);
        toast.success(result.pounds === null ? "Value cleared" : `Saved ${formatGBP(Math.round(result.pounds * 100))}`);
      } catch (e) {
        const err = e instanceof ApiError ? e : null;
        if (err?.status === 400) {
          setError(err.issues[0]?.message ?? "The server rejected that value.");
        } else if (err?.status === 404) {
          toast.error(`${lead.name} no longer exists`);
          onGone();
        } else {
          toast.error("Couldn't save the value", {
            description: err?.status === 0 ? "LeadLine can't reach the server." : err?.requestId ? `Request ${err.requestId}` : "Try again.",
          });
        }
      }
    });
  };

  return (
    <Section title="Treatment plan value">
      <form
        className="flex gap-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">£</span>
          <label htmlFor="treatment-value" className="sr-only">
            Treatment plan value in pounds
          </label>
          <Input
            id="treatment-value"
            inputMode="decimal"
            className="h-10 pl-7 font-mono tabular-nums"
            placeholder="0"
            value={value}
            disabled={pending}
            aria-invalid={!!error}
            aria-describedby={error ? "treatment-value-error" : "treatment-value-hint"}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>
        <Button type="submit" size="lg" className="h-10 px-4" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
      {error ? (
        <p id="treatment-value-error" className="mt-2 text-xs text-overdue">
          {error}
        </p>
      ) : (
        <p id="treatment-value-hint" className="mt-2 text-xs text-muted-foreground">
          {lead.stage === "TREATMENT_ACCEPTED" && lead.treatmentValuePence == null
            ? "Add the plan value so this lead counts in revenue reports."
            : "Whole pounds or pence, up to £250,000. Leave empty to clear."}
        </p>
      )}
    </Section>
  );
}
