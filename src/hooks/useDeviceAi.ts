"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkDeviceSupport,
  clearCrashFlag,
  deleteDeviceAi,
  isModelDownloaded,
  lastLoadCrashed,
  loadDeviceAi,
  unloadDeviceAi,
} from "@/lib/ai/device";

export type DeviceAiStatus = "off" | "checking" | "unsupported" | "loading" | "ready" | "error";

export interface DeviceAiState {
  status: DeviceAiStatus;
  progress: number; // 0 – 1
  message: string;
  downloaded: boolean;
}

/**
 * Steuert die Geräte-KI: prüft die Unterstützung, lädt das Modell (mit Fortschritt)
 * und schaltet sich nach einem Absturz beim Laden automatisch ab.
 */
export function useDeviceAi(enabled: boolean, booted: boolean, onCrashDetected: () => void) {
  const [state, setState] = useState<DeviceAiState>({ status: "off", progress: 0, message: "", downloaded: false });
  const modelRef = useRef<string | null>(null);
  const crashHandled = useRef(false);

  // Absturz beim letzten Laden? → Funktion ausschalten, statt erneut abzustürzen
  useEffect(() => {
    if (crashHandled.current || !lastLoadCrashed()) return;
    crashHandled.current = true;
    clearCrashFlag();
    onCrashDetected();
  }, [onCrashDetected]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      unloadDeviceAi();
      queueMicrotask(() => !cancelled && setState((s) => ({ ...s, status: "off", progress: 0, message: "" })));
      return () => {
        cancelled = true;
      };
    }
    if (!booted) return; // erst nach „System starten“ laden

    (async () => {
      setState((s) => ({ ...s, status: "checking", message: "Prüfe Gerät …" }));
      const support = await checkDeviceSupport();
      if (cancelled) return;
      if (!support.ok) {
        setState({ status: "unsupported", progress: 0, message: support.reason, downloaded: false });
        return;
      }
      modelRef.current = support.modelId;
      const downloaded = await isModelDownloaded(support.modelId);
      if (cancelled) return;
      setState({
        status: "loading",
        progress: 0,
        message: downloaded ? "Lade KI aus dem Gerätespeicher …" : "Lade KI herunter (einmalig ca. 700 MB) …",
        downloaded,
      });
      try {
        await loadDeviceAi(support.modelId, (progress, text) => {
          if (!cancelled) setState((s) => ({ ...s, status: "loading", progress, message: simplify(text, progress) }));
        });
        if (!cancelled) setState({ status: "ready", progress: 1, message: "Bereit", downloaded: true });
      } catch (error) {
        console.warn("[JARVIS] Geräte-KI:", error);
        if (!cancelled) {
          setState((s) => ({
            ...s,
            status: "error",
            message:
              "Die KI konnte nicht geladen werden – vermutlich reicht der Speicher dieses Geräts nicht oder die Verbindung wurde unterbrochen.",
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, booted]);

  const remove = useCallback(async () => {
    const id = modelRef.current ?? (await checkDeviceSupport().then((s) => (s.ok ? s.modelId : null)));
    if (id) await deleteDeviceAi(id).catch(() => {});
    setState((s) => ({ ...s, downloaded: false }));
  }, []);

  return { ...state, remove };
}

function simplify(text: string, progress: number): string {
  const pct = Math.round(progress * 100);
  if (/fetch|download|param/i.test(text)) return `Lade KI herunter … ${pct} %`;
  if (/shader|compil|gpu|load/i.test(text)) return `Starte KI … ${pct} %`;
  return `Bereite KI vor … ${pct} %`;
}
