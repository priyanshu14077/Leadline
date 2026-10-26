"use client";

import { CheckIcon, CloudOffIcon, LoaderIcon, RefreshCwIcon } from "lucide-react";
import { useLiveStream, type StreamStatus } from "@/components/app/live-stream";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const COPY: Record<StreamStatus, { label: string; hint: string }> = {
  connecting: { label: "Connecting…", hint: "Opening the live connection to LeadLine." },
  live: { label: "Live", hint: "New leads and moves appear here the moment they happen." },
  resyncing: { label: "Updating…", hint: "Reconnected. Fetching anything that changed while offline." },
  reconnecting: { label: "Reconnecting…", hint: "Lost the live connection. Retrying by itself; changes may be delayed." },
  offline: { label: "Offline", hint: "No live connection for a while. Still retrying; the board may be out of date." },
  failed: { label: "Live updates stopped", hint: "The live connection was refused. Reload to try again." },
};

/** Live connection state, in words, not colour alone. */
export function StatusPill() {
  const { status, justResynced } = useLiveStream();
  const copy = justResynced ? { label: "Updated", hint: "Back online. The board was refreshed." } : COPY[status];
  const tone =
    status === "live" ? "live" : status === "offline" || status === "failed" ? "down" : status === "connecting" ? "idle" : "warn";

  const pill = (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        tone === "live" && "bg-white/10 text-rail-foreground",
        tone === "idle" && "bg-white/5 text-rail-muted",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "down" && "bg-overdue-soft text-overdue",
      )}
    >
      {justResynced ? (
        <CheckIcon className="size-3.5" aria-hidden />
      ) : status === "live" ? (
        <span className="relative flex size-2" aria-hidden>
          <span className="motion-pulse absolute inset-0 rounded-full bg-[oklch(0.8_0.16_155)]" />
        </span>
      ) : status === "offline" || status === "failed" ? (
        <CloudOffIcon className="size-3.5" aria-hidden />
      ) : status === "connecting" ? (
        <LoaderIcon className="size-3.5 motion-safe:animate-spin" aria-hidden />
      ) : (
        <RefreshCwIcon className="size-3.5 motion-safe:animate-spin" aria-hidden />
      )}
      {copy.label}
    </span>
  );

  return (
    <span className="inline-flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="rounded-full">
            {pill}
          </span>
        </TooltipTrigger>
        <TooltipContent>{copy.hint}</TooltipContent>
      </Tooltip>
      {status === "failed" && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-7 rounded-full bg-rail-foreground px-2.5 text-xs font-semibold text-rail"
        >
          Reload
        </button>
      )}
    </span>
  );
}
