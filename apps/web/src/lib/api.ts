import type { Attribution, Board, DemoLeadBody, DemoLeadResult, LeadCard, Practice, Stage, Trace } from "@leadline/shared";

// Server components call the API over the internal URL; browsers use the public one (CORS-allowed).
export const SERVER_API_URL = process.env.API_URL ?? "http://localhost:4000";
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiIssue = { path: (string | number)[]; message: string };

/**
 * A failed API call. `status` 0 means the request never got an HTTP answer (API down, network).
 * `requestId` is the API's x-request-id: quote it to find the exact request in the API logs.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly requestId: string | null,
    readonly detail: string,
    readonly issues: ApiIssue[] = [],
  ) {
    // The request id rides in the message too: an error thrown from a server component only reaches
    // the browser's error boundary as its message.
    super(`${detail}${requestId ? ` (request ${requestId})` : ""}`);
    this.name = "ApiError";
  }
}

/** Pull "request <id>" back out of an error that crossed the server → client boundary. */
export function requestIdOf(error: unknown): string | null {
  if (error instanceof ApiError) return error.requestId;
  const message = error instanceof Error ? error.message : String(error);
  return /\(request ([\w-]{8,64})\)/.exec(message)?.[1] ?? null;
}

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, null, "LeadLine can't reach the server");
  }
  if (!res.ok) {
    // Error bodies are { error, issues? }.
    const body = (await res.json().catch(() => null)) as { error?: string; issues?: ApiIssue[] } | null;
    throw new ApiError(res.status, res.headers.get("x-request-id"), body?.error ?? `HTTP ${res.status}`, body?.issues ?? []);
  }
  return res.json() as Promise<T>;
}

/** Server-side reads (server components). */
export const serverApi = {
  practices: () => request<Practice[]>(SERVER_API_URL, "/practices"),
  practice: (slug: string) => request<Practice>(SERVER_API_URL, `/practices/${encodeURIComponent(slug)}`),
  board: (slug: string) => request<Board>(SERVER_API_URL, `/practices/${encodeURIComponent(slug)}/board`),
  attribution: (slug: string) => request<Attribution>(SERVER_API_URL, `/practices/${encodeURIComponent(slug)}/attribution`),
  trace: (slug: string, traceId: string) =>
    request<Trace>(SERVER_API_URL, `/practices/${encodeURIComponent(slug)}/traces/${encodeURIComponent(traceId)}`),
};

/** Browser-side calls, straight to the API. */
export const browserApi = {
  streamUrl: (slug: string) => `${PUBLIC_API_URL}/practices/${encodeURIComponent(slug)}/stream`,
  board: (slug: string) => request<Board>(PUBLIC_API_URL, `/practices/${encodeURIComponent(slug)}/board`),
  attribution: (slug: string) => request<Attribution>(PUBLIC_API_URL, `/practices/${encodeURIComponent(slug)}/attribution`),
  moveLead: (slug: string, id: string, stage: Stage) =>
    request<LeadCard>(PUBLIC_API_URL, `/practices/${encodeURIComponent(slug)}/leads/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    }),
  setTreatmentValue: (slug: string, id: string, pounds: number | null) =>
    request<LeadCard>(PUBLIC_API_URL, `/practices/${encodeURIComponent(slug)}/leads/${id}/value`, {
      method: "PUT",
      body: JSON.stringify({ pounds }),
    }),
  demoLead: (body: DemoLeadBody) => request<DemoLeadResult>(PUBLIC_API_URL, "/demo/leads", { method: "POST", body: JSON.stringify(body) }),
  trace: (slug: string, traceId: string) =>
    request<Trace>(PUBLIC_API_URL, `/practices/${encodeURIComponent(slug)}/traces/${encodeURIComponent(traceId)}`),
};
