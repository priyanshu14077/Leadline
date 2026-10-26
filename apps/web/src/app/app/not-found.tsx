import Link from "next/link";
import { Suspense } from "react";
import { ProblemPanel } from "@/components/app/problem";
import { Wordmark } from "@/components/brand/wordmark";
import { practiceDirectory } from "@/lib/practice";

/** Unknown clinic slug. Offers the real clinics instead of a dead end. */
export default function ClinicNotFound() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="flex h-13 items-center bg-rail px-4 text-rail-foreground lg:px-6">
        <Link href="/" className="rounded-md px-1 py-1 hover:bg-white/10" aria-label="LeadLine home">
          <Wordmark />
        </Link>
      </header>
      <div className="px-4">
        <ProblemPanel tone="neutral" title="We can't find that clinic">
          The address doesn&apos;t match any clinic in LeadLine. Pick one of these:
          <Suspense fallback={<span className="mt-3 block h-16 rounded bg-muted motion-safe:animate-pulse" />}>
            <ClinicList />
          </Suspense>
        </ProblemPanel>
      </div>
    </div>
  );
}

async function ClinicList() {
  const practices = await practiceDirectory().catch(() => []);
  if (!practices.length) return <span className="mt-3 block">No clinics are set up yet.</span>;
  return (
    <ul className="mt-3 divide-y rounded-lg border bg-background text-foreground">
      {practices.map((p) => (
        <li key={p.slug}>
          <Link href={`/app/${p.slug}/pipeline`} className="flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted">
            {p.name}
            <span className="text-muted-foreground" aria-hidden>→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
