import type { DeliveryOutcome } from "@leadline/shared";
import { cn } from "@/lib/utils";

const OUTCOME: Record<DeliveryOutcome, { label: string; className: string }> = {
  // Counter-stamp ink. Green, amber and red are reserved for the speed-to-lead clock.
  CREATED: { label: "Created", className: "border-brand bg-brand text-primary-foreground dark:text-background" },
  DUPLICATE: { label: "Duplicate", className: "border-brand/70 text-brand" },
  REJECTED: { label: "Rejected", className: "border-foreground/50 text-foreground/70 line-through decoration-1" },
};

/** A delivery outcome, set like a counter stamp: boxed condensed caps. */
export function OutcomeStamp({ outcome, className }: { outcome: DeliveryOutcome; className?: string }) {
  return (
    <span
      className={cn(
        "type-label inline-flex h-5 shrink-0 items-center rounded-[3px] border-[1.5px] px-1.5 text-[0.68rem] leading-none",
        OUTCOME[outcome].className,
        className,
      )}
    >
      {OUTCOME[outcome].label}
    </span>
  );
}
