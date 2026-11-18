/**
 * „KI im Gerät“ (experimentell): Ein kleines Sprachmodell läuft direkt im Browser
 * über WebGPU – kostenlos, ohne Konto, ohne Server. Nur im Browser verwenden.
 *
 * Modell: Llama 3.2 (1B) – klein genug für Tablets und offiziell mit Deutsch.
 * Die Bibliothek (WebLLM) wird erst geladen, wenn die Funktion eingeschaltet ist.
 */

import type { MLCEngine } from "@mlc-ai/web-llm";

const MODEL_F16 = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const MODEL_F32 = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

/** Merker für einen laufenden Ladevorgang – überlebt einen Absturz der Seite. */
const LOADING_FLAG = "jarvis.deviceAi.loading";

export type DeviceAiSupport = { ok: true; modelId: string } | { ok: false; reason: string };

export interface DeviceChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DeviceContext {
  userName?: string;
  localTime?: string;
  tasks?: string[];
}

let engine: MLCEngine | null = null;
let loadingPromise: Promise<MLCEngine> | null = null;
let currentModel: string | null = null;

interface GpuLike {
  requestAdapter(): Promise<{ features: Set<string> } | null>;
}

/** Prüft, ob dieses Gerät WebGPU kann, und wählt die passende Modellvariante. */
export async function checkDeviceSupport(): Promise<DeviceAiSupport> {
  const gpu = (navigator as Navigator & { gpu?: GpuLike }).gpu;
  if (!gpu) {
    return {
      ok: false,
      reason: "Dieser Browser unterstützt WebGPU nicht. Auf iPhone/iPad wird iOS bzw. iPadOS 26 oder neuer benötigt.",
    };
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { ok: false, reason: "Der Grafikchip dieses Geräts steht für die KI nicht zur Verfügung." };
    return { ok: true, modelId: adapter.features.has("shader-f16") ? MODEL_F16 : MODEL_F32 };
  } catch {
    return { ok: false, reason: "Der Grafikchip dieses Geräts steht für die KI nicht zur Verfügung." };
  }
}

/** War der letzte Ladeversuch unvollständig (z. B. weil Safari die Seite neu gestartet hat)? */
export function lastLoadCrashed(): boolean {
  try {
    return localStorage.getItem(LOADING_FLAG) === "1";
  } catch {
    return false;
  }
}

export function clearCrashFlag() {
  try {
    localStorage.removeItem(LOADING_FLAG);
  } catch {
    /* ignorieren */
  }
}

export function isDeviceAiReady(): boolean {
  return engine !== null;
}

/** Lädt (und beim ersten Mal: lädt herunter) das Modell. Mehrfachaufrufe teilen sich einen Ladevorgang. */
export function loadDeviceAi(modelId: string, onProgress: (progress: number, text: string) => void): Promise<MLCEngine> {
  if (engine && currentModel === modelId) return Promise.resolve(engine);
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      localStorage.setItem(LOADING_FLAG, "1");
    } catch {
      /* ignorieren */
    }
    // Speicher als „dauerhaft“ markieren, damit der Download nicht gelöscht wird
    navigator.storage?.persist?.().catch(() => {});
    try {
      const webllm = await import("@mlc-ai/web-llm");
      const created = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report) => onProgress(report.progress, report.text),
      });
      engine = created;
      currentModel = modelId;
      clearCrashFlag();
      return created;
    } catch (error) {
      clearCrashFlag(); // sauber gescheitert (kein Absturz) → kein Absturz-Merker
      throw error;
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

export async function isModelDownloaded(modelId: string): Promise<boolean> {
  try {
    const webllm = await import("@mlc-ai/web-llm");
    return await webllm.hasModelInCache(modelId);
  } catch {
    return false;
  }
}

/** Gibt Speicher frei und löscht den Download vom Gerät. */
export async function deleteDeviceAi(modelId: string) {
  await unloadDeviceAi();
  const webllm = await import("@mlc-ai/web-llm");
  await webllm.deleteModelAllInfoInCache(modelId);
}

export async function unloadDeviceAi() {
  const e = engine;
  engine = null;
  currentModel = null;
  await e?.unload().catch(() => {});
}

function systemPrompt(ctx: DeviceContext): string {
  const lines = [
    "Du bist JARVIS, ein höflicher, eleganter persönlicher Assistent.",
    "Antworte IMMER auf Deutsch und sieze die Nutzerin.",
    "Antworte kurz und natürlich in ein bis drei Sätzen, ohne Listen, ohne Markdown, ohne Emojis.",
    "Wenn du etwas nicht sicher weißt, sag das ehrlich. Erfinde keine Fakten.",
    "Aufgaben, Erinnerungen und Timer verwaltet die App selbst; du kannst sie nicht anlegen.",
  ];
  if (ctx.userName) lines.push(`Die Nutzerin heißt ${ctx.userName}.`);
  if (ctx.localTime) lines.push(`Aktuelle Zeit: ${ctx.localTime}.`);
  if (ctx.tasks?.length) lines.push(`Offene Aufgaben: ${ctx.tasks.slice(0, 8).join("; ")}.`);
  return lines.join("\n");
}

/** Erzeugt eine Antwort Stück für Stück. */
export async function* deviceChat(messages: DeviceChatMessage[], ctx: DeviceContext): AsyncGenerator<string> {
  if (!engine) throw new Error("Geräte-KI ist nicht geladen.");
  const chunks = await engine.chat.completions.create({
    stream: true,
    temperature: 0.6,
    max_tokens: 300,
    messages: [{ role: "system", content: systemPrompt(ctx) }, ...messages.slice(-6)],
  });
  for await (const chunk of chunks) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}
