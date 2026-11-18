"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { SyncPayload } from "@/lib/push/types";

/**
 * Benachrichtigungen (Web Push) auf diesem Gerät: erlauben, abmelden, testen und
 * dem Server melden, wann Erinnerungen/Timer/Morgenbericht fällig sind.
 * Auf iPhone/iPad nur in der installierten App (Home-Bildschirm) verfügbar.
 */

const DEVICE_KEY = "jarvis.deviceId";
const noopSubscribe = () => () => {};

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "unbekannt-geraet";
  }
}

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(timeoutMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export type PushSyncData = Omit<SyncPayload, "deviceId" | "subscription">;

export function usePush(accessCode: string) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    () => false,
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Besteht bereits ein Abo?
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => !cancelled && setSubscribed(Boolean(sub)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const post = useCallback(
    (url: string, body: unknown, method = "POST") =>
      fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "x-jarvis-code": accessCode },
        body: JSON.stringify(body),
      }),
    [accessCode],
  );

  /** Muss direkt durch Tippen ausgelöst werden (iPhone/iPad). */
  const enable = useCallback(
    async (data: PushSyncData) => {
      setError(null);
      setInfo(null);
      if (!supported) {
        setError("Dieser Browser unterstützt keine Benachrichtigungen.");
        return;
      }
      setBusy(true);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError(
            "Benachrichtigungen wurden nicht erlaubt. Sie lassen sich in den Einstellungen des iPads unter „Mitteilungen → JARVIS“ einschalten.",
          );
          return;
        }
        const reg = await getRegistration();
        if (!reg) {
          setError("Benachrichtigungen funktionieren nur in der installierten JARVIS-App (Home-Bildschirm).");
          return;
        }
        const res = await fetch("/api/push/key");
        if (!res.ok) throw new Error("key");
        const { publicKey } = (await res.json()) as { publicKey: string };
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(publicKey),
          }));
        const saved = await post("/api/push/sync", { ...data, deviceId: getDeviceId(), subscription: sub.toJSON() });
        if (!saved.ok) throw new Error(`sync ${saved.status}`);
        setSubscribed(true);
        setInfo("Benachrichtigungen sind aktiv.");
      } catch (e) {
        console.warn("[JARVIS] Push aktivieren:", e);
        setError("Benachrichtigungen konnten nicht eingerichtet werden. Bitte später noch einmal versuchen.");
      } finally {
        setBusy(false);
      }
    },
    [supported, post],
  );

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const reg = await getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      await post("/api/push/sync", { deviceId: getDeviceId() }, "DELETE");
      setSubscribed(false);
    } catch {
      setError("Abmelden hat nicht geklappt. Bitte noch einmal versuchen.");
    } finally {
      setBusy(false);
    }
  }, [post]);

  const sendTest = useCallback(async () => {
    setError(null);
    setInfo(null);
    const res = await post("/api/push/test", { deviceId: getDeviceId() }).catch(() => null);
    if (res?.ok) setInfo("Test gesendet – die Benachrichtigung sollte gleich erscheinen.");
    else setError("Der Test hat nicht geklappt. Schalten Sie Benachrichtigungen einmal aus und wieder ein.");
  }, [post]);

  /** Meldet dem Server den aktuellen Stand (Erinnerungen, Timer, Morgenbericht). */
  const sync = useCallback(
    async (data: PushSyncData) => {
      if (!supported) return;
      const reg = await getRegistration(1500);
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) {
        setSubscribed(false);
        return;
      }
      await post("/api/push/sync", { ...data, deviceId: getDeviceId(), subscription: sub.toJSON() }).catch(() => {});
    },
    [supported, post],
  );

  return { supported, subscribed, busy, error, info, enable, disable, sendTest, sync };
}
