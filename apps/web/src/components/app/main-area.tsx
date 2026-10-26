"use client";

import { useLiveStream } from "@/components/app/live-stream";
import { cn } from "@/lib/utils";

/** The page area. Dims while the clinic switcher navigates, so stale data never reads as current. */
export function MainArea({ children }: { children: React.ReactNode }) {
  const { switching } = useLiveStream();
  return (
    <main
      id="main"
      aria-busy={switching || undefined}
      className={cn("flex min-h-0 flex-1 flex-col transition-opacity duration-200", switching && "pointer-events-none opacity-50")}
    >
      {children}
    </main>
  );
}
