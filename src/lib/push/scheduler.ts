/**
 * Der Taktgeber: läuft jede Minute (Netlify Scheduled Function) und verschickt
 * fällige Erinnerungen, abgelaufene Timer und den Morgenbericht – auch wenn
 * JARVIS auf dem iPad geschlossen ist.
 */
import { composeBriefing, fetchWeather, geocodeCity, isBriefingDue, localParts } from "./briefing";
import { sendPush, type SendResult } from "./send";
import type { KeyValueStore } from "./store";
import type { DeviceRecord, PushMessage, PushSubscriptionData } from "./types";

/** Ältere verpasste Termine nicht mehr nachträglich melden. */
const MAX_LATE_MS = 6 * 60 * 60 * 1000;

export interface SchedulerDeps {
  send: (subscription: PushSubscriptionData, message: PushMessage) => Promise<SendResult>;
  geocode: typeof geocodeCity;
  weather: typeof fetchWeather;
}

export interface SchedulerReport {
  devices: number;
  sent: number;
  briefings: number;
  removedSubscriptions: number;
}

export async function runScheduler(
  kv: KeyValueStore,
  now: Date = new Date(),
  deps: SchedulerDeps = {
    send: (sub, msg) => sendPush(kv, sub, msg),
    geocode: geocodeCity,
    weather: fetchWeather,
  },
): Promise<SchedulerReport> {
  const report: SchedulerReport = { devices: 0, sent: 0, briefings: 0, removedSubscriptions: 0 };
  const keys = await kv.list("device/");

  for (const key of keys) {
    const device = await kv.get<DeviceRecord>(key);
    if (!device?.subscription) continue;
    report.devices++;
    let changed = false;
    let gone = false;

    // 1) Fällige Erinnerungen und Timer
    const due = device.jobs.filter((j) => {
      const at = Date.parse(j.at);
      return !device.sentJobIds.includes(j.id) && at <= now.getTime() && now.getTime() - at <= MAX_LATE_MS;
    });
    for (const job of due) {
      const result = await deps.send(device.subscription, { title: job.title, body: job.body, tag: job.id, url: "/" });
      if (result === "gone") {
        gone = true;
        break;
      }
      if (result === "ok") {
        report.sent++;
        device.sentJobIds.push(job.id);
        changed = true;
      }
    }

    // 2) Morgenbericht
    if (!gone && isBriefingDue(device, now)) {
      let weather: string | null = null;
      const city = device.briefing.city.trim();
      if (city) {
        if (!device.briefingState.geo || device.briefingState.geo.city !== city) {
          const geo = await deps.geocode(city);
          if (geo) device.briefingState.geo = { city, ...geo };
        }
        const geo = device.briefingState.geo;
        if (geo) weather = await deps.weather(geo.lat, geo.lon);
      }
      const result = await deps.send(device.subscription, composeBriefing(device, now, weather));
      if (result === "gone") gone = true;
      else if (result === "ok") {
        report.briefings++;
        device.briefingState.lastSentDate = localParts(now, device.timeZone).date;
        changed = true;
      }
    }

    if (gone) {
      // Das Gerät hat Benachrichtigungen abbestellt → Abo entfernen
      device.subscription = null;
      report.removedSubscriptions++;
      changed = true;
    }

    // Gesendete IDs aufräumen (nur noch bekannte Aufträge behalten)
    const known = new Set(device.jobs.map((j) => j.id));
    const pruned = device.sentJobIds.filter((id) => known.has(id));
    if (pruned.length !== device.sentJobIds.length) {
      device.sentJobIds = pruned;
      changed = true;
    }

    if (changed) await kv.set(key, device);
  }
  return report;
}
