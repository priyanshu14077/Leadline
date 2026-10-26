import type { Board as BoardData } from "@leadline/shared";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadError } from "@/components/app/load-error";
import { Board } from "@/components/board/board";
import { BoardSkeleton } from "@/components/board/board-skeleton";
import { ApiError, serverApi } from "@/lib/api";

export const metadata = { title: "Pipeline" };

/** Always dynamic: board data changes by the second and is then pushed live over SSE. */
export default function PipelinePage({ params }: PageProps<"/app/[practice]/pipeline">) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <PipelineData params={params} />
    </Suspense>
  );
}

async function PipelineData({ params }: Pick<PageProps<"/app/[practice]/pipeline">, "params">) {
  const { practice: slug } = await params;
  let board: BoardData;
  try {
    board = await serverApi.board(slug);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 404) notFound();
    return <LoadError what="the board" status={e.status} requestId={e.requestId} />;
  }
  return <Board practiceSlug={slug} leads={board.leads} lostCount={board.lostCount} deliveries={board.deliveries} />;
}
