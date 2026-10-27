import type { Attribution } from "@leadline/shared";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadError } from "@/components/app/load-error";
import { AttributionSkeleton, AttributionView } from "@/components/attribution/attribution-view";
import { ApiError, serverApi } from "@/lib/api";

export const metadata = { title: "Attribution" };

/**
 * Always dynamic, like the board: it changes with every drag and plan value, and the live stream
 * already tells the page when to refetch, so a cached copy would only ever be out of date.
 */
export default function AttributionPage({ params }: PageProps<"/app/[practice]/attribution">) {
  return (
    <Suspense fallback={<AttributionSkeleton />}>
      <AttributionData params={params} />
    </Suspense>
  );
}

async function AttributionData({ params }: Pick<PageProps<"/app/[practice]/attribution">, "params">) {
  const { practice: slug } = await params;
  let attribution: Attribution;
  try {
    attribution = await serverApi.attribution(slug);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 404) notFound();
    return <LoadError what="attribution" status={e.status} requestId={e.requestId} />;
  }
  return <AttributionView practiceSlug={slug} attribution={attribution} />;
}
