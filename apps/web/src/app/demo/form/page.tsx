import Link from "next/link";
import { Suspense } from "react";
import { LoadError } from "@/components/app/load-error";
import { Wordmark } from "@/components/brand/wordmark";
import { DemoForm, type ClinicOption } from "@/components/demo/demo-form";
import { ApiError, serverApi } from "@/lib/api";
import { practiceDirectory } from "@/lib/practice";

export const metadata = { title: "Try the ad form" };

/** A sample ad lead form for the demo. Static frame; clinics and campaigns stream in. */
export default function DemoFormPage() {
  return (
    <div className="min-h-dvh">
      <header className="bg-rail text-rail-foreground">
        <div className="mx-auto flex h-13 max-w-6xl items-center gap-3 px-4 lg:px-6">
          <Link href="/" className="rounded-md px-1 py-1 hover:bg-white/10" aria-label="LeadLine home">
            <Wordmark />
          </Link>
          <Link href="/app" className="ml-auto rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium hover:bg-white/10">
            Open the app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 lg:px-6 lg:py-12">
        <h1 className="text-2xl font-semibold sm:text-3xl">Try the ad form</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          A stand-in for a clinic&apos;s lead ad. Fill it in as a patient would and the lead travels the same signed webhook path as
          a real ad platform&apos;s. Demo data only: please don&apos;t enter real people&apos;s details.
        </p>
        <div className="mt-8">
          <Suspense fallback={<div className="h-[34rem] max-w-[26rem] animate-pulse rounded-xl border bg-card motion-reduce:animate-none" />}>
            <Clinics />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function Clinics() {
  let clinics: ClinicOption[];
  try {
    const practices = await practiceDirectory();
    // Campaign names come from attribution, the one endpoint that lists a clinic's campaigns.
    clinics = await Promise.all(
      practices.map(async (p) => ({
        slug: p.slug,
        name: p.name,
        campaigns: (await serverApi.attribution(p.slug)).campaigns.map((c) => ({ utmCampaign: c.utmCampaign, name: c.name })),
      })),
    );
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    return <LoadError what="the clinics" status={e.status} requestId={e.requestId} />;
  }
  // The clinic /app opens on, so the form and the board match out of the box.
  return <DemoForm clinics={clinics} defaultSlug={process.env.DEFAULT_PRACTICE} />;
}
