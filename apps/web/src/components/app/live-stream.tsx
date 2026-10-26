"use client";

import type { StreamMessage } from "@leadline/shared";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useLeadStream, type StreamConnection } from "@/hooks/use-lead-stream";

/**
 * What the status pill shows. `offline` = reconnecting for longer than OFFLINE_AFTER_MS (still
 * retrying) or the browser reports no network. `failed` = EventSource gave up for good.
 */
export type StreamStatus = "connecting" | "live" | "reconnecting" | "resyncing" | "offline" | "failed";

const OFFLINE_AFTER_MS = 30_000;
const SLOW_RECONNECT_MS = 5_000;
const UPDATED_FLASH_MS = 2_000;

type Listener = (msg: StreamMessage) => void;

type LiveStream = {
  slug: string | null;
  status: StreamStatus;
  /** Reconnecting for long enough that the board should say changes may be delayed. */
  degraded: boolean;
  /** True for a moment after a resync finished: "Updated". */
  justResynced: boolean;
  /** The clinic switcher is navigating to another clinic. */
  switching: boolean;
  startSwitch: (fn: () => void) => void;
  subscribe: (fn: Listener) => () => void;
  bind: (slug: string) => void;
};

const Ctx = createContext<LiveStream | null>(null);

/**
 * One EventSource per app session, shared by every page under /app/[practice]. Pages subscribe to
 * messages; the header pill reads the connection state. On resync the provider refreshes the router,
 * so each page's server data (board, deliveries) is fetched again and adopted.
 */
export function LiveStreamProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [slug, setSlug] = useState<string | null>(null);
  const [connection, setConnection] = useState<StreamConnection>("connecting");
  const since = useRef(0);
  const [reconnectingMs, setReconnectingMs] = useState(0);
  const [online, setOnline] = useState(true);
  const [resyncing, startResync] = useTransition();
  const [switching, startSwitching] = useTransition();
  const [justResynced, setJustResynced] = useState(false);
  const listeners = useRef(new Set<Listener>());

  useLeadStream(slug, {
    onMessage: (msg) => listeners.current.forEach((fn) => fn(msg)),
    onResync: () => {
      startResync(() => router.refresh());
      setJustResynced(true);
      setTimeout(() => setJustResynced(false), UPDATED_FLASH_MS);
    },
    onConnection: (state) => {
      setConnection(state);
      since.current = Date.now();
      setReconnectingMs(0);
    },
  });

  // Re-evaluate "reconnecting too long" while reconnecting.
  useEffect(() => {
    if (connection !== "reconnecting") return;
    const t = setInterval(() => setReconnectingMs(Date.now() - since.current), 1000);
    return () => clearInterval(t);
  }, [connection]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const reconnectingFor = connection === "reconnecting" ? reconnectingMs : 0;

  let status: StreamStatus;
  if (connection === "closed") status = "failed";
  else if (!online || reconnectingFor >= OFFLINE_AFTER_MS) status = "offline";
  else if (connection === "reconnecting") status = "reconnecting";
  else if (resyncing) status = "resyncing";
  else status = connection;

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);
  const bind = useCallback((next: string) => setSlug(next), []);
  const startSwitch = useCallback((fn: () => void) => startSwitching(fn), []);

  const value: LiveStream = {
    slug,
    status,
    degraded: status === "offline" || status === "failed" || reconnectingFor >= SLOW_RECONNECT_MS,
    justResynced: justResynced && status === "live",
    switching,
    startSwitch,
    subscribe,
    bind,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiveStream() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLiveStream must be used inside <LiveStreamProvider>");
  return ctx;
}

/** Subscribe a page to stream messages for as long as it is mounted. */
export function useStreamMessages(onMessage: Listener) {
  const { subscribe } = useLiveStream();
  const ref = useRef(onMessage);
  useEffect(() => {
    ref.current = onMessage;
  });
  useEffect(() => subscribe((msg) => ref.current(msg)), [subscribe]);
}

/** Rendered by the clinic-aware part of the layout once the slug is known. */
export function BindStream({ slug }: { slug: string }) {
  const { bind } = useLiveStream();
  useEffect(() => bind(slug), [bind, slug]);
  return null;
}
