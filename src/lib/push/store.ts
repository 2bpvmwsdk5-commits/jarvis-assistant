/**
 * Kleiner Schlüssel-Wert-Speicher für die Benachrichtigungen.
 *  - Bei Netlify: Netlify Blobs (kostenlos, automatisch eingerichtet)
 *  - Lokal/Tests: JSON-Dateien im Ordner .data/
 * Nur relative Importe – die Datei wird auch von der Netlify-Funktion genutzt.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { getStore } from "@netlify/blobs";

export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

function hasNetlifyBlobs(): boolean {
  const g = globalThis as { netlifyBlobsContext?: unknown };
  return Boolean(g.netlifyBlobsContext || process.env.NETLIFY_BLOBS_CONTEXT);
}

function netlifyStore(): KeyValueStore {
  const store = getStore({ name: "jarvis", consistency: "strong" });
  return {
    async get<T>(key: string) {
      return ((await store.get(key, { type: "json" })) as T | null) ?? null;
    },
    async set(key, value) {
      await store.setJSON(key, value);
    },
    async delete(key) {
      await store.delete(key);
    },
    async list(prefix) {
      const { blobs } = await store.list({ prefix });
      return blobs.map((b) => b.key);
    },
  };
}

function fileStore(dir: string): KeyValueStore {
  const file = (key: string) => path.join(dir, `${encodeURIComponent(key)}.json`);
  return {
    async get<T>(key: string) {
      try {
        return JSON.parse(await fs.readFile(file(key), "utf8")) as T;
      } catch {
        return null;
      }
    },
    async set(key, value) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file(key), JSON.stringify(value));
    },
    async delete(key) {
      await fs.rm(file(key), { force: true });
    },
    async list(prefix) {
      try {
        const names = await fs.readdir(dir);
        return names
          .filter((n) => n.endsWith(".json"))
          .map((n) => decodeURIComponent(n.slice(0, -5)))
          .filter((k) => k.startsWith(prefix));
      } catch {
        return [];
      }
    },
  };
}

let cached: KeyValueStore | null = null;

export function getKeyValueStore(): KeyValueStore {
  if (!cached) {
    cached = hasNetlifyBlobs()
      ? netlifyStore()
      : fileStore(process.env.JARVIS_DATA_DIR || path.join(process.cwd(), ".data"));
  }
  return cached;
}

/** Nur für Tests. */
export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    async get<T>(key: string) {
      const v = map.get(key);
      return v ? (JSON.parse(v) as T) : null;
    },
    async set(key, value) {
      map.set(key, JSON.stringify(value));
    },
    async delete(key) {
      map.delete(key);
    },
    async list(prefix) {
      return [...map.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}
