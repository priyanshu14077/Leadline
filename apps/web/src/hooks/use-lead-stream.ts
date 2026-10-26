"use client";

import { useEffect, useRef } from "react";
import type { StreamMessage } from "@leadline/shared";
import { browserApi } from "@/lib/api";

/**
 * What the EventSource is doing right now.
 * - connecting: opened, waiting for the first `ready`.
 * - live: a `ready` arrived on the current connection.
 * - reconnecting: the connection dropped; EventSource is retrying by itself.
 * - closed: EventSource gave up (e.g. a 404 before the stream started). Only a reload recovers.
 */
export type StreamConnection = "connecting" | "live" | "reconnecting" | "closed";

type Handlers = {
  onMessage: (msg: StreamMessage) => void;
  /** Every `ready` after the first: the server says "you may have missed events, refetch". */
  onResync: () => void;
  onConnection: (state: StreamConnection) => void;
};

/**
 * Subscribes to the practice's SSE stream. Events: `ready`, `lead.created`, `lead.updated`,
 * `delivery.logged`. EventSource reconnects by itself. Every `ready` after the first means resync,
 * whether it follows a browser reconnect or the API recovering its own LISTEN connection.
 */
export function useLeadStream(practiceSlug: string | null, handlers: Handlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!practiceSlug) return;
    const source = new EventSource(browserApi.streamUrl(practiceSlug));
    let connectedBefore = false;
    ref.current.onConnection("connecting");
    const handle = (e: MessageEvent<string>) => ref.current.onMessage(JSON.parse(e.data) as StreamMessage);

    source.addEventListener("ready", () => {
      ref.current.onConnection("live");
      if (connectedBefore) ref.current.onResync();
      connectedBefore = true;
    });
    source.addEventListener("error", () => {
      ref.current.onConnection(source.readyState === EventSource.CLOSED ? "closed" : "reconnecting");
    });
    source.addEventListener("lead.created", handle);
    source.addEventListener("lead.updated", handle);
    source.addEventListener("delivery.logged", handle);
    return () => source.close();
  }, [practiceSlug]);
}
