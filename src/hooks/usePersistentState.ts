"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Speichert einen Wert dauerhaft im Browser (localStorage) und hält
 * alle Komponenten, die ihn benutzen, automatisch synchron.
 */

type Listener = () => void;

interface Store<T> {
  get(): T;
  set(value: T | ((prev: T) => T)): void;
  subscribe(listener: Listener): () => void;
  initial: T;
}

const stores = new Map<string, Store<unknown>>();

function createStore<T>(key: string, initial: T): Store<T> {
  let cache: T | undefined;
  const listeners = new Set<Listener>();

  const read = (): T => {
    if (cache !== undefined) return cache;
    try {
      const raw = window.localStorage.getItem(key);
      cache = raw ? (JSON.parse(raw) as T) : initial;
      // Neue Felder in Objekten (z. B. Einstellungen) mit Standardwerten ergänzen
      if (
        raw &&
        initial &&
        typeof initial === "object" &&
        !Array.isArray(initial) &&
        cache &&
        typeof cache === "object"
      ) {
        cache = { ...initial, ...cache };
      }
    } catch {
      cache = initial;
    }
    return cache as T;
  };

  return {
    initial,
    get: read,
    set(value) {
      const next = typeof value === "function" ? (value as (prev: T) => T)(read()) : value;
      cache = next;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* Speicher voll oder privat – Wert bleibt trotzdem im Arbeitsspeicher */
      }
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function getStore<T>(key: string, initial: T): Store<T> {
  let store = stores.get(key) as Store<T> | undefined;
  if (!store) {
    store = createStore(key, initial);
    stores.set(key, store as Store<unknown>);
  }
  return store;
}

export function usePersistentState<T>(key: string, initial: T) {
  const store = getStore(key, initial);
  const value = useSyncExternalStore(store.subscribe, store.get, () => store.initial);
  const setValue = useCallback((v: T | ((prev: T) => T)) => store.set(v), [store]);
  return [value, setValue] as const;
}

/** Liefert true, sobald die Seite im Browser läuft (nicht beim Server-Rendering). */
const noopSubscribe = () => () => {};
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
