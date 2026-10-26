import { STAGE_COLOR } from "@/components/board/stage";
import { BOARD_STAGES, STAGE_LABEL } from "@/lib/format";

/** Same frame as the board, so nothing jumps when the data streams in. */
export function BoardSkeleton() {
  return (
    <div aria-label="Loading the board" className="flex flex-1 flex-col gap-3 px-3 py-3 sm:px-4 lg:px-6 lg:py-4 xl:h-[calc(100dvh_-_5.75rem)] xl:min-h-0 xl:flex-none">
      <div className="flex flex-wrap gap-x-1 gap-y-2">
        {["Waiting for a first call", "Over 5 minutes", "Longest wait", "Lost"].map((label) => (
          <div key={label} className="flex min-w-[7.5rem] flex-col rounded-lg bg-surface px-3 py-1.5">
            <span className="my-1 h-5 w-8 rounded bg-muted motion-safe:animate-pulse" />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <div className="grid flex-1 gap-4 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="-mx-3 flex gap-3 overflow-hidden px-3 sm:-mx-4 sm:px-4 xl:mx-0 xl:grid xl:grid-cols-4 xl:px-0">
          {BOARD_STAGES.map((s) => (
            <section key={s} className="flex w-[calc(100vw-2.25rem)] shrink-0 flex-col overflow-hidden rounded-xl bg-surface sm:w-[19rem] xl:w-auto">
              <span aria-hidden className={`h-[3px] ${STAGE_COLOR[s]}`} />
              <h2 className="type-label px-3 pt-2.5 pb-2 text-[0.8rem]">{STAGE_LABEL[s]}</h2>
              <div className="space-y-2 px-2 pb-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[4.6rem] rounded-lg border bg-card/70 motion-safe:animate-pulse" />
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="hidden rounded-xl border bg-card p-4 xl:block">
          <span className="type-label text-[0.8rem]">Webhook deliveries</span>
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 rounded bg-muted motion-safe:animate-pulse" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
