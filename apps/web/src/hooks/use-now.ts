"use client";

import { useSyncExternalStore } from "react";

// One shared 1s ticker for every timer on the page, instead of an interval per card.
let now = Date.now();
const subscribers = new Set<() => void>();
let interval: ReturnType<typeof setInterval> | undefined;

function subscribe(fn: () => void) {
  subscribers.add(fn);
  interval ??= setInterval(() => {
    now = Date.now();
    subscribers.forEach((s) => s());
  }, 1000);
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size) {
      clearInterval(interval);
      interval = undefined;
    }
  };
}

export function useNow() {
  // Server snapshot is null so server HTML never bakes in a stale time.
  return useSyncExternalStore(subscribe, () => now, () => null);
}
