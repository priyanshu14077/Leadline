"use client";

import { ProblemPanel } from "@/components/app/problem";
import { Button } from "@/components/ui/button";
import { requestIdOf } from "@/lib/api";

/** Catches failures of the app frame itself, e.g. the clinic lookup when the API is down. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="min-h-dvh bg-background px-4">
      <ProblemPanel
        title="LeadLine can't reach the server"
        requestId={requestIdOf(error)}
        actions={<Button onClick={() => retry()}>Retry</Button>}
      >
        The clinic couldn&apos;t be loaded. Check the LeadLine API is running, then retry.
      </ProblemPanel>
    </div>
  );
}
