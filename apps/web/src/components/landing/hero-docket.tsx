"use client";

import { useEffect, useState } from "react";
import { Postmark } from "@/components/brand/postmark";
import { OutcomeStamp } from "@/components/deliveries/outcome-stamp";
import { formatElapsed, timerTone } from "@/lib/format";
import { cn } from "@/lib/utils";

const DELIVERIES = [
  { at: "20:41:07", outcome: "CREATED" as const, note: "lead stored" },
  { at: "20:41:09", outcome: "DUPLICATE" as const, note: "retry, same lead id" },
  { at: "20:41:12", outcome: "DUPLICATE" as const, note: "retry, same lead id" },
];

/** Counts up from when the page opened, like a lead that has just arrived. */
function useWaiting() {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const start = Date.now() - 4000;
    const tick = () => setMs(Date.now() - start);
    const t = setInterval(tick, 1000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, []);
  return ms;
}

/**
 * The hero's demonstration, labelled synthetic: three deliveries of one lead, stamped, folding into a
 * single card whose clock is running. Everything is visible by default; motion only staggers it in.
 */
export function HeroDocket() {
  const waiting = useWaiting();
  const tone = waiting === null ? "ok" : timerTone(waiting);
  return (
    <figure
      aria-label="Example: three deliveries of one lead become one card"
      className="relative w-full rounded-[10px] bg-[oklch(0.99_0.003_255)] text-[oklch(0.23_0.035_262)] shadow-[0_2px_0_oklch(0.2_0.1_264/0.25),0_30px_60px_-25px_oklch(0.12_0.08_264/0.7)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-[oklch(0.85_0.015_258)] px-5 pt-4 pb-3">
        <span className="type-label text-[0.8rem] tracking-[0.08em]">Proof of delivery</span>
        <span className="text-[0.7rem] text-[oklch(0.46_0.03_260)]">Synthetic example</span>
      </div>
      <ol className="px-5 pt-2 pb-3">
        {DELIVERIES.map((d, i) => (
          <li
            key={d.at}
            className="landing-reveal flex items-center gap-3 border-b border-dotted border-[oklch(0.88_0.012_258)] py-2.5 last:border-b-0"
            style={{ animationDelay: `${300 + i * 420}ms` }}
          >
            <span className="font-mono text-xs text-[oklch(0.46_0.03_260)] tabular-nums">{d.at}</span>
            {/* The docket is paper in both themes, so its ink is fixed rather than themed. */}
            <OutcomeStamp
              outcome={d.outcome}
              className={cn(
                d.outcome === "CREATED"
                  ? "border-[oklch(0.44_0.17_263)] bg-[oklch(0.44_0.17_263)] text-white dark:text-white"
                  : "border-[oklch(0.44_0.17_263/0.7)] bg-transparent text-[oklch(0.44_0.17_263)]",
              )}
            />
            <span className="truncate text-xs text-[oklch(0.46_0.03_260)]">{d.note}</span>
          </li>
        ))}
      </ol>
      <div className="landing-reveal px-5 pb-5" style={{ animationDelay: "1650ms" }}>
        <p className="type-label mb-2 flex items-center gap-2 text-[0.75rem] text-[oklch(0.44_0.17_263)]">
          <span aria-hidden className="h-px flex-1 bg-[oklch(0.44_0.17_263/0.35)]" />3 deliveries → 1 lead
          <span aria-hidden className="h-px flex-1 bg-[oklch(0.44_0.17_263/0.35)]" />
        </p>
        <div className="relative rounded-lg border border-[oklch(0.44_0.17_263)] bg-white p-3.5 ring-4 ring-[oklch(0.44_0.17_263/0.12)]">
          <Postmark
            time="20:41"
            className="landing-stamp absolute right-4 -bottom-5 bg-white text-[oklch(0.44_0.17_263)]"
            style={{ animationDelay: "1900ms" }}
          />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Amelia Hart</p>
              <p className="mt-0.5 text-xs text-[oklch(0.46_0.03_260)]">
                <span className="type-label mr-1.5 text-[0.7rem] text-[oklch(0.23_0.035_262/0.7)]">Meta</span>
                Invisalign lead form
              </p>
            </div>
            <span
              className={cn(
                "inline-flex h-7 min-w-[4.75rem] items-center justify-center gap-1.5 rounded-full px-2.5 font-mono text-sm font-medium tabular-nums",
                tone === "ok" && "bg-[oklch(0.95_0.04_155)] text-[oklch(0.45_0.12_155)]",
                tone === "warn" && "bg-[oklch(0.95_0.05_80)] text-[oklch(0.48_0.12_60)]",
                (tone === "overdue" || tone === "critical") && "bg-[oklch(0.95_0.035_25)] text-[oklch(0.5_0.2_27)]",
              )}
              role="timer"
              aria-label="Waiting for a first call"
            >
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {waiting === null ? "0:04" : formatElapsed(waiting)}
            </span>
          </div>
          <p className="mt-3 pr-14 text-xs text-[oklch(0.46_0.03_260)]">Waiting for a first call. Amber at 3 minutes, red at 5.</p>
        </div>
      </div>
    </figure>
  );
}
