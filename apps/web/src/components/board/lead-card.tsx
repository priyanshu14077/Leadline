"use client";

import { useDraggable } from "@dnd-kit/core";
import type { LeadCard as Lead, Stage } from "@leadline/shared";
import { LoaderIcon } from "lucide-react";
import { Postmark } from "@/components/brand/postmark";
import { MoveMenu } from "@/components/board/move-menu";
import { SpeedTimer } from "@/components/board/speed-timer";
import { useNow } from "@/hooks/use-now";
import { formatClock, formatDateTime, formatDayShort, PLATFORM_LABEL, SOURCE_LABEL, TREATMENT_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CardFlags = { fresh?: boolean; pending?: boolean; rolledBack?: boolean };

/** The postmark that lands on a lead in its first seconds on the board. */
export function ArrivalStamp({ at }: { at: string }) {
  return (
    <Postmark time={formatClock(at).slice(0, 5)} className="motion-stamp absolute right-9 -bottom-3 z-10 bg-card text-brand" />
  );
}

/** Arrival time; a date instead once the lead is from another day (London time). */
function ReceivedAt({ iso }: { iso: string }) {
  const now = useNow();
  const old = now !== null && formatDayShort(new Date(now).toISOString()) !== formatDayShort(iso);
  return (
    <span className="ml-auto shrink-0 font-mono text-[0.7rem] tabular-nums" title={`Received ${formatDateTime(iso)}`}>
      {old ? formatDayShort(iso) : formatClock(iso).slice(0, 5)}
    </span>
  );
}

function CardBody({ lead }: { lead: Lead }) {
  const platform = lead.campaign ? PLATFORM_LABEL[lead.campaign.platform] : null;
  return (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate pt-0.5 text-sm font-semibold">{lead.name}</span>
        <SpeedTimer lead={lead} className="shrink-0" />
      </span>
      {lead.triageStatus === "DONE" && lead.treatmentInterest && (
        <span className="mt-1.5 flex items-center gap-1.5 text-xs">
          <span className="rounded-sm bg-brand-soft px-1.5 py-0.5 font-medium text-brand">{TREATMENT_LABEL[lead.treatmentInterest]}</span>
          {lead.urgency === "HIGH" && <span className="rounded-sm bg-overdue-soft px-1.5 py-0.5 text-overdue">Urgent</span>}
        </span>
      )}
      <span className="mt-1.5 flex min-w-0 items-center gap-1.5 pr-8 text-xs text-muted-foreground">
        {platform && <span className="type-label shrink-0 text-[0.7rem] text-foreground/70">{platform}</span>}
        <span className="truncate">{lead.campaign?.name.replace(/\s+–\s+.*$/, "") ?? SOURCE_LABEL[lead.source]}</span>
        <ReceivedAt iso={lead.receivedAt} />
      </span>
    </>
  );
}

/** Static card, used in the drag overlay. */
export function LeadCardView({ lead, dragging }: { lead: Lead; dragging?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-card p-3 text-left", dragging && "rotate-1 shadow-[0_18px_40px_-16px_oklch(0.25_0.1_262/0.45)]")}>
      <CardBody lead={lead} />
    </div>
  );
}

/**
 * A card on the board. The card body is a button (Enter or click opens the lead). Dragging works by
 * mouse, or by press-and-hold on touch, so a swipe still scrolls. Keyboard and touch users change
 * stage with the Move menu.
 */
export function DraggableLeadCard({
  lead,
  flags,
  onOpen,
  onMove,
}: {
  lead: Lead;
  flags: CardFlags;
  onOpen: () => void;
  onMove: (to: Stage) => void;
}) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, data: { stage: lead.stage } });
  return (
    <div
      ref={setNodeRef}
      data-lead-id={lead.id}
      {...listeners}
      className={cn(
        "group/card relative rounded-lg border bg-card transition-[box-shadow,opacity,border-color] duration-200",
        "shadow-[0_1px_0_oklch(0.3_0.05_262/0.04)] hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_18%)]",
        "cursor-grab active:cursor-grabbing [touch-action:manipulation]",
        flags.fresh && "motion-arrive border-brand ring-2 ring-brand/35",
        flags.rolledBack && "border-overdue ring-2 ring-overdue/30",
        isDragging && "opacity-30",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <CardBody lead={lead} />
      </button>
      <MoveMenu
        name={lead.name}
        stage={lead.stage}
        onMove={(to) => {
          onMove(to);
          // Keep keyboard focus on the lead after it moves column (or on the board if it left it).
          requestAnimationFrame(() =>
            requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-lead-id="${lead.id}"] > button`)?.focus()),
          );
        }}
        className="absolute right-1 bottom-1 size-7 opacity-60 group-hover/card:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
      />
      {flags.fresh && <ArrivalStamp at={lead.receivedAt} />}
      {flags.pending && (
        <span className="absolute top-1/2 -left-2 grid size-4 -translate-y-1/2 place-items-center rounded-full bg-card shadow" role="status">
          <LoaderIcon className="size-3 text-brand motion-safe:animate-spin" aria-hidden />
          <span className="sr-only">Saving move</span>
        </span>
      )}
    </div>
  );
}
