/**
 * Versand von Benachrichtigungen (Web Push).
 * Die nötigen Schlüssel (VAPID) erzeugt JARVIS beim ersten Mal selbst und speichert
 * sie im Netlify-Speicher – Sie müssen dafür nichts einrichten.
 */
import webpush from "web-push";
import type { KeyValueStore } from "./store";
import type { PushMessage, PushSubscriptionData } from "./types";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

const VAPID_KEY = "config/vapid";

export async function getVapidKeys(kv: KeyValueStore): Promise<VapidKeys> {
  const existing = await kv.get<VapidKeys>(VAPID_KEY);
  if (existing?.publicKey && existing.privateKey) return existing;
  const fresh = webpush.generateVAPIDKeys();
  await kv.set(VAPID_KEY, fresh);
  // Falls zwei Anfragen gleichzeitig Schlüssel erzeugt haben: den gespeicherten verwenden
  return (await kv.get<VapidKeys>(VAPID_KEY)) ?? fresh;
}

/** Nur die offiziellen Push-Dienste der Browser-Hersteller sind erlaubt. */
const ALLOWED_PUSH_HOSTS = [
  "push.apple.com", // Safari / iPhone / iPad (z. B. web.push.apple.com)
  "fcm.googleapis.com", // Chrome / Android
  "android.googleapis.com",
  "push.services.mozilla.com", // Firefox
  "notify.windows.com", // Edge / Windows
];

export function isAllowedEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (process.env.JARVIS_PUSH_ALLOW_LOCAL === "1" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
    return true; // nur für Tests
  }
  if (url.protocol !== "https:") return false;
  return ALLOWED_PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

export type SendResult = "ok" | "gone" | "error";

export async function sendPush(
  kv: KeyValueStore,
  subscription: PushSubscriptionData,
  message: PushMessage,
): Promise<SendResult> {
  if (!isAllowedEndpoint(subscription.endpoint)) return "gone";
  const keys = await getVapidKeys(kv);
  const subject = process.env.URL?.startsWith("https://") ? process.env.URL : "mailto:jarvis@example.com";
  try {
    await webpush.sendNotification(subscription, JSON.stringify(message), {
      vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
      TTL: 60 * 60,
      urgency: "high",
      timeout: 10_000,
    });
    return "ok";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone"; // Abo existiert nicht mehr
    console.error("[JARVIS] Push fehlgeschlagen:", status ?? error);
    return "error";
  }
}
