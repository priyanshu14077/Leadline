import type { StreamMessage } from "@leadline/shared";
import { Client } from "pg";
import { prisma } from "./db";
import { recentDeliveries } from "./deliveries";
import { getLeadCard } from "./leads";
import { forPractice } from "./tenant";
import { saveSpans } from "./trace";

export const CHANNEL = "lead_events";

type TraceContext = { traceId?: string; startedAt?: number };

export type LeadEvent = TraceContext &
  (
    | { type: "lead.created"; practiceId: string; leadId: string }
    | { type: "lead.updated"; practiceId: string; leadId: string }
    | { type: "delivery.logged"; practiceId: string; deliveryId: string }
  );

type Listener = (msg: StreamMessage) => void;
/** Called when this process's LISTEN connection recovers: events in the gap were missed. */
type Resync = () => void;

type Executor = Pick<typeof prisma, "$executeRaw">;

/**
 * Broadcast to every API process LISTENing on the channel. Payload stays tiny (8 KB NOTIFY limit).
 * Pass a transaction client to tie the event to its writes: Postgres delivers a NOTIFY only when
 * that transaction commits, and never if it rolls back.
 */
export async function publish(event: LeadEvent, db: Executor = prisma) {
  await db.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(event)})`;
}

type Hub = {
  client: Client | null;
  connecting: Promise<void> | null;
  listeners: Map<string, Set<Listener>>;
  resyncs: Map<Listener, Resync>;
};

// One LISTEN connection per process, kept on globalThis so watch-mode reloads don't open more.
const hub = ((globalThis as unknown as { leadlineHub?: Hub }).leadlineHub ??= {
  client: null,
  connecting: null,
  listeners: new Map(),
  resyncs: new Map(),
});
// Older hubs kept on globalThis across watch-mode reloads predate the resync map.
hub.resyncs ??= new Map();

export function streamCount(practiceId?: string) {
  if (practiceId) return hub.listeners.get(practiceId)?.size ?? 0;
  return [...hub.listeners.values()].reduce((n, s) => n + s.size, 0);
}

async function resolve(event: LeadEvent): Promise<StreamMessage | null> {
  const db = forPractice(event.practiceId);
  if (event.type === "delivery.logged") {
    const [delivery] = await recentDeliveries(db, { id: event.deliveryId, take: 1 });
    return delivery ? { type: event.type, traceId: event.traceId, delivery } : null;
  }
  const lead = await getLeadCard(db, event.leadId);
  return lead ? { type: event.type, traceId: event.traceId, lead } : null;
}

async function onNotification(payload: string | undefined) {
  if (!payload) return;
  const event = JSON.parse(payload) as LeadEvent;
  const since = () => (event.startedAt ? Date.now() - event.startedAt : 0);
  const spans = [];
  const who = `api pid ${process.pid}`;

  spans.push({ name: `NOTIFY received · ${event.type}`, offsetMs: since(), durationMs: null, detail: who });
  const listeners = hub.listeners.get(event.practiceId);
  // Nobody watching this practice from this process: skip the query entirely.
  if (listeners?.size) {
    const start = since();
    const msg = await resolve(event);
    spans.push({ name: `loaded once for ${event.type}`, offsetMs: start, durationMs: since() - start, detail: "1 query, shared by every tab" });
    if (msg) for (const fn of listeners) fn(msg);
    spans.push({ name: `SSE push · ${event.type}`, offsetMs: since(), durationMs: null, detail: `${listeners.size} open stream${listeners.size === 1 ? "" : "s"} on ${who}` });
  } else {
    spans.push({ name: `no open streams · ${event.type}`, offsetMs: since(), durationMs: null, detail: who });
  }
  if (event.traceId) await saveSpans(event.practiceId, event.traceId, spans);
}

function connect(isReconnect = false): Promise<void> {
  hub.connecting ??= (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const reset = () => {
      if (hub.client !== client) return;
      hub.client = null;
      client.end().catch(() => {});
      // Reconnect while anyone is still listening. Events during the gap are missed, and the
      // browsers' SSE streams never dropped, so they won't resync by themselves: connect() tells them.
      setTimeout(() => {
        if (streamCount()) connect(true).catch(console.error);
      }, 1000);
    };
    // Handled one at a time in NOTIFY order: each needs a query, and parallel queries can finish
    // out of order, letting an older lead.updated overwrite a newer one in the browser.
    let queue = Promise.resolve();
    client.on("notification", (msg) => {
      queue = queue.then(() => onNotification(msg.payload)).catch(console.error);
    });
    client.on("error", reset);
    client.on("end", reset);
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    hub.client = client;
    if (isReconnect) for (const resync of hub.resyncs.values()) resync();
  })().finally(() => {
    hub.connecting = null;
  });
  return hub.connecting;
}

export async function subscribe(practiceId: string, fn: Listener, onResync?: Resync) {
  let set = hub.listeners.get(practiceId);
  if (!set) hub.listeners.set(practiceId, (set = new Set<Listener>()));
  set.add(fn);
  if (onResync) hub.resyncs.set(fn, onResync);
  if (!hub.client) await connect();
  return () => {
    set.delete(fn);
    hub.resyncs.delete(fn);
  };
}

/** For graceful shutdown and tests. */
export async function closeHub() {
  const client = hub.client;
  hub.client = null;
  hub.listeners.clear();
  hub.resyncs.clear();
  await client?.end();
}
