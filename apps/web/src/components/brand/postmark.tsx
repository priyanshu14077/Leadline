import { cn } from "@/lib/utils";

/**
 * The arrival postmark: a double ring, NEW in condensed caps over the arrival time.
 * The same ring as the wordmark, at stamp scale. The caller sets ink (text colour) and paper (background).
 */
export function Postmark({ time, className, style }: { time: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "stamp-rest pointer-events-none grid size-12 place-items-center rounded-full border-2 border-current p-[3px] shadow-[0_2px_6px_-2px_oklch(0.3_0.12_263/0.35)]",
        className,
      )}
    >
      <span className="flex size-full flex-col items-center justify-center rounded-full border border-current leading-none">
        <span className="type-label text-[0.62rem] tracking-[0.12em]">New</span>
        <span className="mt-0.5 font-mono text-[0.6rem] tabular-nums">{time}</span>
      </span>
    </span>
  );
}
