"use client";

import { useSyncExternalStore } from "react";

/** Aktuelle Uhrzeit, die sich jede Sekunde aktualisiert (eine gemeinsame Uhr für alle). */

let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useNow(): Date | null {
  const value = useSyncExternalStore(
    subscribe,
    () => now || (now = Date.now()),
    () => 0,
  );
  return value ? new Date(value) : null;
}
