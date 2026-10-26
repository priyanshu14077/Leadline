import type { DeliveryRow } from "@leadline/shared";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadError } from "@/components/app/load-error";
import { DeliveriesView, DeliveriesSkeleton } from "@/components/deliveries/deliveries-view";
import { ApiError, serverApi } from "@/lib/api";

export const metadata = { title: "Deliveries" };

/** Always dynamic; new deliveries arrive over the shared live stream. */
export default function DeliveriesPage({ params }: PageProps<"/app/[practice]/deliveries">) {
  return (
    <Suspense fallback={<DeliveriesSkeleton />}>
      <DeliveriesData params={params} />
    </Suspense>
  );
}

async function DeliveriesData({ params }: Pick<PageProps<"/app/[practice]/deliveries">, "params">) {
  const { practice: slug } = await params;
  let deliveries: DeliveryRow[];
  try {
    // The API has no deliveries endpoint yet; the board payload carries the latest 30.
    ({ deliveries } = await serverApi.board(slug));
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 404) notFound();
    return <LoadError what="the deliveries" status={e.status} requestId={e.requestId} />;
  }
  return <DeliveriesView practiceSlug={slug} deliveries={deliveries} />;
}
