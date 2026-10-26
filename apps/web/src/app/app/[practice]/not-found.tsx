import Link from "next/link";
import { ProblemPanel } from "@/components/app/problem";
import { Button } from "@/components/ui/button";

/** A trace or record inside a known clinic that doesn't exist (or belongs to another clinic). */
export default function RecordNotFound() {
  return (
    <div className="px-4">
      <ProblemPanel
        tone="neutral"
        title="Nothing recorded at this address"
        actions={
          <Button variant="outline" asChild>
            <Link href="/app">Back to the board</Link>
          </Button>
        }
      >
        There&apos;s no trace with this id for this clinic. A trace is only visible to the clinic that received the
        request, and a request rejected for a bad signature is never recorded.
      </ProblemPanel>
    </div>
  );
}
