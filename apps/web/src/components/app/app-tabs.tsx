"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "pipeline", label: "Pipeline" },
  { segment: "deliveries", label: "Deliveries" },
  { segment: "attribution", label: "Attribution", coming: true },
] as const;

/** Reads the URL, so it sits behind its own Suspense boundary in the layout. */
export function AppTabs() {
  const { practice } = useParams<{ practice: string }>();
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="-mb-px flex h-full items-stretch gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const href = `/app/${practice}/${t.segment}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={t.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-rail-foreground font-semibold text-rail-foreground"
                : "border-transparent text-rail-muted hover:text-rail-foreground",
            )}
          >
            {t.label}
            {"coming" in t && (
              <span className="type-label rounded-sm border border-rail-muted/50 px-1 text-[0.68rem] leading-4 text-rail-muted">
                Coming
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppTabsSkeleton() {
  return (
    <div className="flex h-full items-stretch gap-1" aria-hidden>
      {TABS.map((t) => (
        <span key={t.segment} className="inline-flex items-center px-3 text-sm text-rail-muted">
          {t.label}
        </span>
      ))}
    </div>
  );
}
