import type { Stage } from "@leadline/shared";
import { STAGE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const STAGE_ORDER: Stage[] = ["NEW", "CONTACTED", "CONSULT_BOOKED", "TREATMENT_ACCEPTED", "LOST"];

/** One colour per stage, used for the column rule and the dot wherever a stage is named. */
export const STAGE_COLOR: Record<Stage, string> = {
  NEW: "bg-stage-new",
  CONTACTED: "bg-stage-contacted",
  CONSULT_BOOKED: "bg-stage-consult",
  TREATMENT_ACCEPTED: "bg-stage-accepted",
  LOST: "bg-stage-lost",
};

export function StageDot({ stage, className }: { stage: Stage; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", STAGE_COLOR[stage], className)} />;
}

export function StageName({ stage }: { stage: Stage }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StageDot stage={stage} />
      {STAGE_LABEL[stage]}
    </span>
  );
}
