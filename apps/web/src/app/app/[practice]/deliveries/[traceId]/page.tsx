import type { Trace } from "@leadline/shared";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadError } from "@/components/app/load-error";
import { RequestId } from "@/components/app/problem";
import { TraceBody } from "@/components/trace/trace-view";
import { ApiError, serverApi } from "@/lib/api";

export const metadata = { title: "Trace" };

/**
 * Always dynamic. A trace is written in stages after the webhook responds, so a cached copy could
 * freeze an early, partial trace. The client keeps polling until the hub's spans arrive.
 */
export default function TracePage({ params }: PageProps<"/app/[practice]/deliveries/[traceId]">) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 lg:px-6 lg:py-8">
      <Suspense fallback={<TraceFrame back={null} traceId={null} />}>
        <TraceData params={params} />
      </Suspense>
    </div>
  );
}

function TraceFrame({ back, traceId, children }: { back: string | null; traceId: string | null; children?: React.ReactNode }) {
  return (
    <>
      {back ? (
        <Link href={back} className="inline-flex h-6 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden /> Deliveries
        </Link>
      ) : (
        <span className="block h-6" />
      )}
      <h1 className="mt-3 text-2xl font-semibold">Tracking history</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Every step of one webhook request, from the moment it arrived to the push to every open tab.
      </p>
      {traceId && <RequestId id={traceId} className="mt-3" />}
      <div className="mt-6 rounded-xl border bg-card p-4 sm:p-6">
        {children ?? <div className="h-72 rounded bg-muted motion-safe:animate-pulse" aria-label="Loading trace" />}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Search the API log for this request id to see every log line from the same request.
      </p>
    </>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function TraceData({ params }: Pick<PageProps<"/app/[practice]/deliveries/[traceId]">, "params">) {
  const { practice: slug, traceId } = await params;
  const back = `/app/${slug}/deliveries`;
  let trace: Trace | null = null;
  // A trace opened right after its webhook may not be written yet: give it about a second.
  for (const wait of [0, 300, 700]) {
    if (wait) await sleep(wait);
    try {
      trace = await serverApi.trace(slug, traceId);
      break;
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      if (e.status === 404) continue;
      return (
        <TraceFrame back={back} traceId={traceId}>
          <LoadError what="the trace" status={e.status} requestId={e.requestId} />
        </TraceFrame>
      );
    }
  }
  if (!trace) notFound();
  return (
    <TraceFrame back={back} traceId={traceId}>
      <TraceBody practiceSlug={slug} traceId={traceId} initial={trace} />
    </TraceFrame>
  );
}
