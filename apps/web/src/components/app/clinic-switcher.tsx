"use client";

import type { Practice } from "@leadline/shared";
import { ChevronsUpDownIcon, LoaderIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useLiveStream } from "@/components/app/live-stream";

/**
 * The clinic is the one thing a closer must never get wrong, so its name is the page title and the
 * switcher is a native select laid over it (keyboard and screen-reader behaviour for free).
 */
export function ClinicSwitcher({ practice, practices }: { practice: Practice; practices: Practice[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { switching, startSwitch } = useLiveStream();
  // Same section, other clinic. A trace belongs to one clinic, so a trace page lands on the new clinic's log.
  const section = pathname.split("/")[3] ?? "pipeline";
  const target = (slug: string) => `/app/${slug}/${section}`;

  return (
    <label className="relative inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-white/10 has-focus-visible:outline-2 has-focus-visible:outline-rail-foreground">
      <span className="sr-only">Clinic</span>
      <span className="truncate text-[0.95rem] font-semibold text-rail-foreground">{practice.name}</span>
      {switching ? (
        <LoaderIcon className="size-4 shrink-0 text-rail-muted motion-safe:animate-spin" aria-hidden />
      ) : (
        <ChevronsUpDownIcon className="size-4 shrink-0 text-rail-muted" aria-hidden />
      )}
      <select
        aria-label="Clinic"
        className="absolute inset-0 cursor-pointer appearance-none opacity-0 focus-visible:outline-none"
        value={practice.slug}
        onChange={(e) => {
          const slug = e.target.value;
          startSwitch(() => router.push(target(slug)));
        }}
      >
        {practices.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
