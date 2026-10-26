import Link from "next/link";
import { ProblemPanel } from "@/components/app/problem";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <ProblemPanel
        tone="neutral"
        title="No page at this address"
        actions={
          <>
            <Button asChild>
              <Link href="/app">Open the live board</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">LeadLine home</Link>
            </Button>
          </>
        }
      >
        The board moved to <code className="font-mono text-xs">/app</code>. Old clinic links like{" "}
        <code className="font-mono text-xs">/smile-studio-london</code> no longer work.
      </ProblemPanel>
    </div>
  );
}
