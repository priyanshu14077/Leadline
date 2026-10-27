import type { Practice } from "@leadline/shared";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { ApiError, SERVER_API_URL, serverApi } from "@/lib/api";

/**
 * The clinic directory, cached: clinics change rarely, and the switcher and title read it on every
 * navigation. Per-instance memory cache (the default `use cache` store).
 *
 * On-demand revalidation: none today, on purpose (see docs/05-ui-ux-audit.md §5). If an admin flow
 * ever adds clinics, it calls revalidateTag("practices", "max") from a server action. Attribution was
 * the candidate for webhook-triggered revalidation; it stays dynamic instead, because it changes with
 * every drag and the live stream already tells the page when to refetch.
 */
export async function practiceDirectory(): Promise<Practice[]> {
  "use cache";
  cacheTag("practices");
  cacheLife("days");
  // A plain fetch: `use cache` owns the caching here, so no fetch-level cache option.
  const res = await fetch(`${SERVER_API_URL}/practices`);
  if (!res.ok) throw new ApiError(res.status, res.headers.get("x-request-id"), `Couldn't load the clinic list (HTTP ${res.status})`);
  return (await res.json()) as Practice[];
}

/**
 * One clinic by slug. Decided outside the cache: an unknown slug is a 404, and a clinic created after
 * the directory was cached is still found by asking the API directly.
 */
export async function getPractice(slug: string): Promise<Practice> {
  const known = (await practiceDirectory().catch(() => [])).find((p) => p.slug === slug);
  if (known) return known;
  try {
    return await serverApi.practice(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
