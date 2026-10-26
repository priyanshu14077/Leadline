import { cn } from "@/lib/utils";

/** The mark: a postmark ring with its cancellation bars running out to the right. */
export function PostmarkMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" fill="none" aria-hidden className={cn("h-5 w-auto", className)}>
      <circle cx="11" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="11" cy="12" r="5.2" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <path d="M22 8.5h17M22 12h17M22 15.5h17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <PostmarkMark />
      <span className="type-label text-[1.05rem] leading-none tracking-[0.06em]">LeadLine</span>
    </span>
  );
}
