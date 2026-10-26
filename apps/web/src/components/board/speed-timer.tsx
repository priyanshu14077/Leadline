"use client";

import type { LeadCard } from "@leadline/shared";
import { CheckIcon } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { formatElapsed, RED_MS, spokenElapsed, timerTone } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Speed-to-lead: live until first contact, then frozen at how long contact took.
 * Fixed width and tabular digits, so "–:––" before hydration and every tick occupy the same space.
 */
export function SpeedTimer({ lead, className }: { lead: LeadCard; className?: string }) {
  const now = useNow();
  const received = Date.parse(lead.receivedAt);

  if (lead.firstContactedAt) {
    const took = Date.parse(lead.firstContactedAt) - received;
    const fast = took < RED_MS;
    return (
      <span
        className={cn(
          "inline-flex h-6 min-w-[4.25rem] items-center justify-end gap-1 font-mono text-xs tabular-nums",
          fast ? "text-ok" : "text-muted-foreground",
          className,
        )}
        title={`Contacted after ${formatElapsed(took)}`}
      >
        <CheckIcon className="size-3.5" aria-hidden />
        <span className="sr-only">Contacted after </span>
        {formatElapsed(took)}
      </span>
    );
  }

  if (lead.stage === "LOST") {
    return <span className={cn("inline-flex h-6 items-center text-xs text-muted-foreground", className)}>Not contacted</span>;
  }

  const waiting = now === null ? null : now - received;
  const tone = waiting === null ? null : timerTone(waiting);
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-[4.25rem] items-center justify-center gap-1.5 rounded-full px-2 font-mono text-xs font-medium tabular-nums",
        tone === null && "bg-muted text-muted-foreground",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "overdue" && "bg-overdue-soft text-overdue",
        tone === "critical" && "bg-overdue text-white dark:text-[oklch(0.18_0.02_262)]",
        className,
      )}
      role="timer"
      aria-label={waiting === null ? "Waiting for first contact" : `Waiting ${spokenElapsed(waiting)} for first contact`}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === null && "bg-muted-foreground/50",
          tone === "ok" && "bg-ok",
          tone === "warn" && "bg-warn",
          tone === "overdue" && "motion-pulse bg-overdue",
          tone === "critical" && "bg-current",
        )}
      />
      <span aria-hidden>{waiting === null ? "–:––" : formatElapsed(waiting)}</span>
    </span>
  );
}
