"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ProblemPanel } from "@/components/app/problem";
import { Button } from "@/components/ui/button";

/** Inline error for a server read that failed: Retry re-runs the server components. */
export function LoadError({ what, status, requestId }: { what: string; status: number; requestId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unreachable = status === 0;
  return (
    <ProblemPanel
      title={unreachable ? "LeadLine can't reach the server" : `Couldn't load ${what}`}
      requestId={requestId}
      actions={
        <Button onClick={() => start(() => router.refresh())} disabled={pending}>
          {pending ? "Retrying…" : "Retry"}
        </Button>
      }
    >
      {unreachable
        ? "The LeadLine API isn't answering. Check it's running, then retry."
        : `The server answered with an error (HTTP ${status}). Retry, and quote the request id if it keeps happening.`}
    </ProblemPanel>
  );
}
