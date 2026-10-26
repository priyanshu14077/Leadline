"use client";

import type { Stage } from "@leadline/shared";
import { ArrowRightLeftIcon } from "lucide-react";
import { StageDot, STAGE_ORDER } from "@/components/board/stage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STAGE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The non-drag way to change stage: keyboard, touch and screen readers. */
export function MoveMenu({
  name,
  stage,
  onMove,
  className,
}: {
  name: string;
  stage: Stage;
  onMove: (to: Stage) => void;
  className?: string;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={`Move ${name} to another stage`}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
          className,
        )}
        // A press on the menu must not start a card drag.
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <ArrowRightLeftIcon className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        // The card is re-rendered in another column, so the trigger focus would return to is gone.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel>Move {name} to</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={stage} onValueChange={(v) => v !== stage && onMove(v as Stage)}>
          {STAGE_ORDER.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              <StageDot stage={s} />
              {STAGE_LABEL[s]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
