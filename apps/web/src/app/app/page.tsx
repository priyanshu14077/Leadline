import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { practiceDirectory } from "@/lib/practice";

export const metadata = { title: "Opening the board" };

export default function AppIndex() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center bg-rail text-rail-foreground">
          <Wordmark />
        </div>
      }
    >
      <RedirectToDefault />
    </Suspense>
  );
}

/** /app goes to the default clinic's pipeline. */
async function RedirectToDefault() {
  const practices = await practiceDirectory();
  const target = practices.find((p) => p.slug === process.env.DEFAULT_PRACTICE) ?? practices[0];
  if (!target) return <NoClinics />;
  redirect(`/app/${target.slug}/pipeline`);
}

function NoClinics() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold">No clinics set up yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          LeadLine has no clinics to show. Seed the demo data, then reload this page.
        </p>
      </div>
    </div>
  );
}
