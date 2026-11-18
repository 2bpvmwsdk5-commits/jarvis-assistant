/**
 * Morgenbericht: Datum, Wetter, heutige Erinnerungen, offene Aufgaben, nächster Countdown.
 * Wetter über Open-Meteo (kostenlos, ohne Anmeldung).
 */
import type { DeviceRecord, PushMessage } from "./types";

/* ───────────── Ortszeit des Geräts ───────────── */

export interface LocalParts {
  date: string; // „JJJJ-MM-TT“
  minutes: number; // Minuten seit Mitternacht
}

export function localParts(now: Date, timeZone: string): LocalParts {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    return localParts(now, "Europe/Berlin");
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function dayDiff(fromYmd: string, toYmd: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(toYmd) - toUtc(fromYmd)) / 86_400_000);
}

export function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Ist der Morgenbericht jetzt fällig? (bis zu 60 Minuten nach der Wunschzeit, einmal pro Tag) */
export function isBriefingDue(device: DeviceRecord, now: Date): boolean {
  if (!device.briefing.enabled) return false;
  const target = parseHHMM(device.briefing.time);
  if (target === null) return false;
  const local = localParts(now, device.timeZone);
  if (device.briefingState.lastSentDate === local.date) return false;
  return local.minutes >= target && local.minutes < target + 60;
}

/* ───────────── Wetter ───────────── */

const WEATHER_TEXT: [number[], string][] = [
  [[0], "sonnig"],
  [[1], "überwiegend sonnig"],
  [[2], "leicht bewölkt"],
  [[3], "bedeckt"],
  [[45, 48], "neblig"],
  [[51, 53, 55, 56, 57], "Nieselregen"],
  [[61, 63, 65, 66, 67], "Regen"],
  [[71, 73, 75, 77], "Schnee"],
  [[80, 81, 82], "Regenschauer"],
  [[85, 86], "Schneeschauer"],
  [[95, 96, 99], "Gewitter"],
];

export function weatherText(code: number): string {
  return WEATHER_TEXT.find(([codes]) => codes.includes(code))?.[1] ?? "wechselhaft";
}

const GEO_BASE = () => process.env.JARVIS_GEOCODING_BASE || "https://geocoding-api.open-meteo.com";
const WEATHER_BASE = () => process.env.JARVIS_WEATHER_BASE || "https://api.open-meteo.com";

export async function geocodeCity(city: string): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const url = `${GEO_BASE()}/v1/search?name=${encodeURIComponent(city)}&count=1&language=de&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: { latitude: number; longitude: number; name: string }[] };
    const r = data.results?.[0];
    return r ? { lat: r.latitude, lon: r.longitude, label: r.name } : null;
  } catch {
    return null;
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<string | null> {
  try {
    const url =
      `${WEATHER_BASE()}/v1/forecast?latitude=${lat}&longitude=${lon}` +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1";
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const d = (
      (await res.json()) as {
        daily?: {
          weather_code: number[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          precipitation_probability_max?: (number | null)[];
        };
      }
    ).daily;
    if (!d) return null;
    const min = Math.round(d.temperature_2m_min[0]);
    const max = Math.round(d.temperature_2m_max[0]);
    const rain = d.precipitation_probability_max?.[0];
    const rainText = typeof rain === "number" && rain >= 30 ? `, Regenrisiko ${rain} %` : "";
    return `${min} bis ${max} °C, ${weatherText(d.weather_code[0])}${rainText}`;
  } catch {
    return null;
  }
}

/* ───────────── Bericht zusammenstellen ───────────── */

export function composeBriefing(device: DeviceRecord, now: Date, weather: string | null): PushMessage {
  const tz = device.timeZone;
  const local = localParts(now, tz);
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => {
    try {
      return d.toLocaleString("de-DE", { ...o, timeZone: tz });
    } catch {
      return d.toLocaleString("de-DE", o);
    }
  };

  const lines: string[] = [];
  const dateLine = fmt(now, { weekday: "long", day: "numeric", month: "long" });
  const place = device.briefingState.geo?.label;
  lines.push(weather ? `${dateLine} · ${place ?? "Wetter"}: ${weather}.` : `${dateLine}.`);

  const today = device.tasks
    .filter((t) => t.remindAt && localParts(new Date(t.remindAt), tz).date === local.date)
    .sort((a, b) => Date.parse(a.remindAt!) - Date.parse(b.remindAt!));
  if (today.length) {
    const items = today.slice(0, 3).map((t) => `${fmt(new Date(t.remindAt!), { hour: "2-digit", minute: "2-digit" })} ${t.title}`);
    lines.push(`Heute: ${items.join(", ")}${today.length > 3 ? " …" : ""}.`);
  }

  const open = device.tasks.length;
  if (open) {
    const other = device.tasks.find((t) => !today.includes(t));
    lines.push(
      `${open} offene ${open === 1 ? "Aufgabe" : "Aufgaben"}${other ? `, z. B. „${other.title}“` : ""}.`,
    );
  }

  const next = device.countdowns
    .map((c) => ({ ...c, days: dayDiff(local.date, c.date) }))
    .filter((c) => c.days >= 0 && c.days <= 60)
    .sort((a, b) => a.days - b.days)[0];
  if (next) {
    lines.push(next.days === 0 ? `Heute ist es so weit: „${next.title}“!` : `Noch ${next.days} ${next.days === 1 ? "Tag" : "Tage"} bis „${next.title}“.`);
  }

  if (lines.length === 1) lines.push("Keine Termine heute – ein freier Tag.");

  return {
    title: device.userName ? `Guten Morgen, ${device.userName}!` : "Guten Morgen!",
    body: lines.join("\n"),
    tag: `briefing-${local.date}`,
    url: "/",
  };
}
