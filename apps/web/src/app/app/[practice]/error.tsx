"use client";

import Link from "next/link";
import { ProblemPanel } from "@/components/app/problem";
import { Button } from "@/components/ui/button";
import { requestIdOf } from "@/lib/api";

export default function PracticeError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  return (
    <ProblemPanel
      title="Something went wrong on this page"
      requestId={requestIdOf(error)}
      actions={
        <>
          <Button onClick={() => retry()}>Retry</Button>
          <Button variant="outline" asChild>
            <Link href="/app">Back to the board</Link>
          </Button>
        </>
      }
    >
      The page hit an error it couldn&apos;t recover from. Retry first.
      {digest && <span className="mt-1 block font-mono text-xs">Reference {digest}</span>}
    </ProblemPanel>
  );
}
