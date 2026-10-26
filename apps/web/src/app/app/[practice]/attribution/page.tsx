import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Attribution (coming next)" };

/**
 * Not built. Honest placeholder: what the page will measure, and no numbers.
 * When built: `use cache` + cacheTag(`attribution:${slug}`) + cacheLife("minutes") (docs/05 §5).
 */
export default function AttributionPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-6 lg:py-12">
      <h1 className="text-2xl font-semibold text-balance sm:text-3xl">
        Which campaigns make money, not just leads{" "}
        <span className="type-label relative -top-1 ml-1 inline-flex rounded-sm border px-1.5 align-middle text-[0.72rem] text-muted-foreground">
          Coming next
        </span>
      </h1>
      <p className="mt-3 max-w-prose text-muted-foreground">
        Ad platforms report clicks and cost per form fill. A clinic is paid by booked consults and accepted treatment plans. This
        page isn&apos;t built yet. When it is, it will show, for each campaign:
      </p>
      <dl className="mt-8 divide-y rounded-xl border border-dashed">
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
          <dt className="font-semibold">Cost per booked consult</dt>
          <dd className="text-sm text-muted-foreground">Ad spend divided by leads that reached Consult booked.</dd>
        </div>
        <div className="grid gap-1 px-5 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
          <dt className="font-semibold">Treatment value per £1</dt>
          <dd className="text-sm text-muted-foreground">Accepted plan value divided by ad spend.</dd>
        </div>
      </dl>
      <p className="mt-6 max-w-prose text-sm text-muted-foreground">
        The data is already being kept: every lead stores its campaign, each stage records when it was first reached, and the plan
        value is entered in the lead drawer.
      </p>
      <Button asChild variant="outline" className="mt-8">
        <Link href="pipeline">Back to the pipeline</Link>
      </Button>
    </div>
  );
}
