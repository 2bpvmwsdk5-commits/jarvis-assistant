/** Prüft und speichert, was ein Gerät an den Server meldet. */
import { isAllowedEndpoint } from "./send";
import type { KeyValueStore } from "./store";
import type { DeviceRecord, PushJob, PushSubscriptionData, SyncPayload } from "./types";

const ID_RE = /^[a-zA-Z0-9-]{8,64}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const deviceKey = (id: string) => `device/${id}`;

export function validateDeviceId(v: unknown): string | null {
  return typeof v === "string" && ID_RE.test(v) ? v : null;
}

function validTimeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("de-DE", { timeZone: tz });
    return tz;
  } catch {
    return "Europe/Berlin";
  }
}

export function validateSubscription(v: unknown): PushSubscriptionData | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  const keys = (s.keys ?? {}) as Record<string, unknown>;
  const endpoint = str(s.endpoint, 1000);
  if (!endpoint || !isAllowedEndpoint(endpoint)) return null;
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  return { endpoint, keys: { p256dh: keys.p256dh.slice(0, 200), auth: keys.auth.slice(0, 100) } };
}

export function validatePayload(body: unknown): (SyncPayload & { subscriptionInvalid: boolean }) | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const deviceId = validateDeviceId(b.deviceId);
  if (!deviceId) return null;

  const jobs: PushJob[] = (Array.isArray(b.jobs) ? b.jobs : [])
    .slice(0, 60)
    .map((j) => {
      const o = (j ?? {}) as Record<string, unknown>;
      return {
        id: str(o.id, 64),
        kind: (o.kind === "timer" ? "timer" : "reminder") as PushJob["kind"],
        title: str(o.title, 80) || "JARVIS",
        body: str(o.body, 300),
        at: str(o.at, 40),
      };
    })
    .filter((j) => j.id && !Number.isNaN(Date.parse(j.at)));

  const br = (b.briefing ?? {}) as Record<string, unknown>;
  const subscription = b.subscription === undefined ? undefined : validateSubscription(b.subscription);

  return {
    deviceId,
    subscription: subscription ?? undefined,
    subscriptionInvalid: b.subscription !== undefined && !subscription,
    timeZone: validTimeZone(str(b.timeZone, 60) || "Europe/Berlin"),
    userName: str(b.userName, 40),
    jobs,
    briefing: {
      enabled: br.enabled === true,
      time: /^\d{1,2}:\d{2}$/.test(str(br.time, 5)) ? str(br.time, 5) : "07:30",
      city: str(br.city, 60),
    },
    tasks: (Array.isArray(b.tasks) ? b.tasks : [])
      .slice(0, 30)
      .map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        const remindAt = str(o.remindAt, 40);
        return { title: str(o.title, 120), remindAt: remindAt && !Number.isNaN(Date.parse(remindAt)) ? remindAt : undefined };
      })
      .filter((t) => t.title),
    countdowns: (Array.isArray(b.countdowns) ? b.countdowns : [])
      .slice(0, 20)
      .map((c) => {
        const o = (c ?? {}) as Record<string, unknown>;
        return { title: str(o.title, 80), date: str(o.date, 10) };
      })
      .filter((c) => c.title && /^\d{4}-\d{2}-\d{2}$/.test(c.date)),
  };
}

export async function saveDevice(kv: KeyValueStore, payload: SyncPayload): Promise<DeviceRecord> {
  const key = deviceKey(payload.deviceId);
  const existing = await kv.get<DeviceRecord>(key);
  const now = new Date().toISOString();
  const record: DeviceRecord = {
    deviceId: payload.deviceId,
    subscription: payload.subscription ?? existing?.subscription ?? null,
    timeZone: payload.timeZone,
    userName: payload.userName,
    jobs: payload.jobs,
    briefing: payload.briefing,
    tasks: payload.tasks,
    countdowns: payload.countdowns,
    sentJobIds: existing?.sentJobIds ?? [],
    briefingState: {
      ...existing?.briefingState,
      // Stadt geändert → Ort neu bestimmen
      geo: existing?.briefingState.geo?.city === payload.briefing.city ? existing.briefingState.geo : undefined,
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await kv.set(key, record);
  return record;
}
