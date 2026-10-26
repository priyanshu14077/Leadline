"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** The request id, shown so a user can quote it and an engineer can grep the API log for it. */
export function RequestId({ id, className }: { id: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground", className)}>
      Request
      <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground">{id}</code>
      <button
        type="button"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded hover:bg-muted"
        aria-label={copied ? "Request id copied" : "Copy request id"}
        onClick={async () => {
          await navigator.clipboard?.writeText(id).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <CheckIcon className="size-3.5" aria-hidden /> : <CopyIcon className="size-3.5" aria-hidden />}
      </button>
    </span>
  );
}

/** A whole-area problem: what happened, what to do, and the id to quote. */
export function ProblemPanel({
  title,
  children,
  requestId,
  actions,
  tone = "error",
  className,
}: {
  title: string;
  children?: React.ReactNode;
  requestId?: string | null;
  actions?: React.ReactNode;
  tone?: "error" | "neutral";
  className?: string;
}) {
  return (
    <section
      role={tone === "error" ? "alert" : undefined}
      className={cn("mx-auto my-10 w-full max-w-lg rounded-xl border bg-card px-6 py-7 shadow-[0_1px_2px_oklch(0_0_0/0.04),0_8px_24px_-12px_oklch(0.3_0.1_262/0.18)]", className)}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className={cn(
            "stamp-rest mt-0.5 grid size-11 shrink-0 place-items-center rounded-full border-2 border-double text-[0.6rem]",
            tone === "error" ? "border-overdue text-overdue" : "border-muted-foreground text-muted-foreground",
          )}
        >
          <span className="type-label">{tone === "error" ? "Fault" : "None"}</span>
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-balance">{title}</h1>
          {children && <div className="mt-1.5 text-sm text-muted-foreground">{children}</div>}
          {requestId && <RequestId id={requestId} className="mt-3" />}
          {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
