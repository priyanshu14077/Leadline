import { redirect } from "next/navigation";
import { Suspense } from "react";

export default function PracticeIndex({ params }: PageProps<"/app/[practice]">) {
  return (
    <Suspense>
      <ToPipeline params={params} />
    </Suspense>
  );
}

async function ToPipeline({ params }: Pick<PageProps<"/app/[practice]">, "params">) {
  const { practice } = await params;
  redirect(`/app/${practice}/pipeline`);
  return null;
}
