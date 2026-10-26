import Link from "next/link";
import { Suspense } from "react";
import { AppTabs, AppTabsSkeleton } from "@/components/app/app-tabs";
import { ClinicSwitcher } from "@/components/app/clinic-switcher";
import { BindStream, LiveStreamProvider } from "@/components/app/live-stream";
import { MainArea } from "@/components/app/main-area";
import { StatusPill } from "@/components/app/status-pill";
import { Wordmark } from "@/components/brand/wordmark";
import { getPractice, practiceDirectory } from "@/lib/practice";

/**
 * The app frame. Static shell: the rail, wordmark, tab labels and the status pill render without
 * data. The clinic name and switcher stream in from the cached clinic directory; the tabs read the
 * URL behind their own boundary. One live stream for every page below, owned here.
 */
export default function PracticeLayout({ children, params }: LayoutProps<"/app/[practice]">) {
  return (
    <LiveStreamProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 bg-rail text-rail-foreground">
          <div className="flex h-13 items-center gap-2 px-3 sm:px-4 lg:px-6">
            <Link href="/" className="shrink-0 rounded-md px-1 py-1 hover:bg-white/10" aria-label="LeadLine home">
              <Wordmark />
            </Link>
            <span className="mx-1 h-5 w-px shrink-0 bg-white/20" aria-hidden />
            <Suspense fallback={<span className="h-4 w-40 rounded bg-white/15 motion-safe:animate-pulse" aria-label="Loading clinic" />}>
              <Clinic params={params} />
            </Suspense>
            <div className="ml-auto shrink-0">
              <StatusPill />
            </div>
          </div>
          <div className="h-10 border-t border-white/10 px-1.5 sm:px-2.5 lg:px-4.5">
            <Suspense fallback={<AppTabsSkeleton />}>
              <AppTabs />
            </Suspense>
          </div>
        </header>
        <MainArea>{children}</MainArea>
      </div>
    </LiveStreamProvider>
  );
}

async function Clinic({ params }: Pick<LayoutProps<"/app/[practice]">, "params">) {
  const { practice: slug } = await params;
  const [practice, practices] = await Promise.all([getPractice(slug), practiceDirectory().catch(() => [])]);
  return (
    <>
      <ClinicSwitcher practice={practice} practices={practices.length ? practices : [practice]} />
      <BindStream slug={practice.slug} />
    </>
  );
}
