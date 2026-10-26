"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { RequestId } from "@/components/app/problem";
import { TraceBody } from "@/components/trace/trace-view";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** The trace in a side sheet, from the pipeline's delivery panel. Deep link: the same trace as a page. */
export function TraceSheet({ practiceSlug, traceId, onClose }: { practiceSlug: string; traceId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!traceId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl [&_[data-slot=sheet-close]]:size-11 [&_[data-slot=sheet-close]]:top-2 [&_[data-slot=sheet-close]]:right-2">
        {traceId && (
          <>
            <SheetHeader className="gap-1 border-b px-5 pt-5 pb-4">
              <SheetTitle className="text-lg font-semibold">Tracking history</SheetTitle>
              <SheetDescription>Each step of one webhook request, from arrival to the push to open tabs.</SheetDescription>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <RequestId id={traceId} />
                <Link
                  href={`/app/${practiceSlug}/deliveries/${traceId}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                >
                  Open as a page <ExternalLinkIcon className="size-3" aria-hidden />
                </Link>
              </div>
            </SheetHeader>
            <div className="px-5 py-5">
              <TraceBody key={traceId} practiceSlug={practiceSlug} traceId={traceId} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
