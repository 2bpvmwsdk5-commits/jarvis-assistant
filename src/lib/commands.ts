/**
 * Befehlserkennung: Versteht deutsche Sätze wie
 *  - „Erinnere mich um 15:30 an den Anruf“
 *  - „Erinnere mich in 10 Minuten an die Wäsche“
 *  - „Neue Aufgabe: Einkaufen gehen“
 *  - „Welche Aufgaben habe ich?“
 *  - „Wie spät ist es?“
 *
 * Alles hier ist reine Logik ohne Browser-Abhängigkeit – dadurch gut testbar.
 */

import { parseDateExpr, parseDuration } from "./chrono";

export type Command =
  | { kind: "startTimer"; durationMs: number; label: string }
  | { kind: "cancelTimer" }
  | { kind: "timerStatus" }
  | { kind: "countdownQuery"; date?: Date; label: string }
  | { kind: "addCountdown"; title: string; date: Date }
  | { kind: "listCountdowns" }
  | { kind: "addTask"; title: string; remindAt?: Date }
  | { kind: "listTasks" }
  | { kind: "time" }
  | { kind: "date" }
  | { kind: "help" };

const NUMBER_WORDS: Record<string, number> = {
  eine: 1, einer: 1, einem: 1, ein: 1, zwei: 2, drei: 3, vier: 4, fünf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, fünfzehn: 15, zwanzig: 20,
  dreißig: 30, halbe: 0.5, halben: 0.5,
};

function toNumber(word: string): number | undefined {
  const n = Number(word.replace(",", "."));
  if (!Number.isNaN(n)) return n;
  return NUMBER_WORDS[word.toLowerCase()];
}

function cleanTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^(daran|an|dass|zu|bitte)\s+/i, "")
    .replace(/^(den|die|das|dem|der)\s+(?=\S)/i, "") // „an den Anruf“ → „Anruf“
    .replace(/[.!?]+$/, "")
    .replace(/\s+zu erinnern$/i, "")
    .trim();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Sucht eine Zeitangabe im Text und gibt Datum + den Rest-Text zurück. */
export function extractTime(text: string, now: Date): { date?: Date; rest: string } {
  let rest = text;
  let date: Date | undefined;

  // „in 10 Minuten“, „in einer Stunde“, „in 2 Stunden“, „in einer halben Stunde“
  const relative = rest.match(
    /\bin\s+(?:(einer|einem|eine)\s+)?(\d+(?:[.,]\d+)?|[a-zäöüß]+)\s+(sekunden?|minuten?|min|stunden?|std|tagen?)\b/i,
  );
  if (relative) {
    const amount = toNumber(relative[2]);
    if (amount !== undefined) {
      const unit = relative[3].toLowerCase();
      const ms = unit.startsWith("sek")
        ? 1000
        : unit.startsWith("min")
          ? 60_000
          : unit.startsWith("st")
            ? 3_600_000
            : 86_400_000;
      date = new Date(now.getTime() + amount * ms);
      rest = rest.replace(relative[0], " ");
    }
  }

  if (!date) {
    // „um 15:30“, „um 15.30 Uhr“, „um 9 Uhr“, „um 9“
    const absolute = rest.match(/\bum\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?\b/i);
    if (absolute) {
      const hours = Number(absolute[1]);
      const minutes = absolute[2] ? Number(absolute[2]) : 0;
      if (hours < 24 && minutes < 60) {
        date = new Date(now);
        date.setHours(hours, minutes, 0, 0);
        rest = rest.replace(absolute[0], " ");

        if (/\bübermorgen\b/i.test(rest)) {
          date.setDate(date.getDate() + 2);
          rest = rest.replace(/\bübermorgen\b/i, " ");
        } else if (/\bmorgen\b/i.test(rest)) {
          date.setDate(date.getDate() + 1);
          rest = rest.replace(/\bmorgen\b/i, " ");
        } else if (/\bheute\b/i.test(rest)) {
          rest = rest.replace(/\bheute\b/i, " ");
        } else if (date.getTime() <= now.getTime()) {
          // Uhrzeit heute schon vorbei → morgen
          date.setDate(date.getDate() + 1);
        }
      }
    }
  }

  return { date, rest: rest.replace(/\s+/g, " ").trim() };
}

export function parseCommand(input: string, now: Date = new Date()): Command | null {
  const text = input.trim();
  const lower = text.toLowerCase();
  if (!text) return null;

  const timerCmd = parseTimerCommand(text, lower);
  if (timerCmd) return timerCmd;
  const countdownCmd = parseCountdownCommand(text, lower, now);
  if (countdownCmd) return countdownCmd;

  // Erinnerungen
  const remind = text.match(/^(?:bitte\s+)?erinner(?:e|n)?\s+mich\s+(.*)$/i);
  if (remind) {
    const { date, rest } = extractTime(remind[1], now);
    const title = capitalize(cleanTitle(rest));
    if (title) return { kind: "addTask", title, remindAt: date };
  }

  // Neue Aufgabe
  const add =
    text.match(/^(?:neue\s+aufgabe|aufgabe|notiere|notier|merke\s+dir|merk\s+dir|todo)\s*[:\-]?\s+(.+)$/i) ??
    text.match(/^(?:füge|setze|schreibe)\s+(.+?)\s+(?:zu|auf)\s+(?:meine[rn]?\s+)?(?:aufgaben(?:liste)?|to-?do-?liste|liste)(?:\s+hinzu)?\.?$/i);
  if (add) {
    const { date, rest } = extractTime(add[1], now);
    const title = capitalize(cleanTitle(rest));
    if (title) return { kind: "addTask", title, remindAt: date };
  }

  if (/\b(welche|meine|zeig\w*|liste)\b.*\b(aufgaben|to-?dos?|erinnerungen)\b/.test(lower)) {
    return { kind: "listTasks" };
  }
  if (/\b(wie spät|uhrzeit|wie viel uhr|wieviel uhr)\b/.test(lower)) return { kind: "time" };
  if (/\b(welches datum|welcher tag|der wievielte|datum heute|welchen tag)\b/.test(lower)) {
    return { kind: "date" };
  }
  if (/^(hilfe|help)\b|was kannst du/.test(lower)) return { kind: "help" };

  return null;
}

/* ───────────── Timer ───────────── */

const TIMER_FILLER =
  /\b(bitte|jarvis|stell\w*|setz\w*|start\w*|mach\w*|einen?|neuen?|timer|wecker|eieruhr|auf|mir|mich|weck\w*|in|von|lang)\b/gi;

function parseTimerCommand(text: string, lower: string): Command | null {
  const mentionsTimer = /\b(timer|eieruhr|wecker)\b/.test(lower) || /^weck(e)? mich\b/.test(lower);
  if (!mentionsTimer) return null;

  if (
    /\b(stopp\w*|stop|abbrechen|abbruch|beende\w*|lösch\w*|aus(schalten)?|anhalten|cancel)\b/.test(lower) ||
    /\bbrich\b.*\bab\b/.test(lower)
  ) {
    return { kind: "cancelTimer" };
  }
  if (/\b(wie lange|wie viel zeit|restzeit|übrig|noch|status|läuft)\b/.test(lower)) {
    return { kind: "timerStatus" };
  }

  const duration = parseDuration(text);
  if (!duration) return null;

  // Bezeichnung: „Timer für die Nudeln auf 8 Minuten“ → „Nudeln“
  let label = "Timer";
  const forMatch = duration.rest.match(/\bfür\s+(?:die|den|das|meine[n]?)?\s*(.+)$/i);
  if (forMatch) {
    const cleaned = forMatch[1].replace(TIMER_FILLER, " ").replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim();
    if (cleaned) label = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return { kind: "startTimer", durationMs: Math.min(duration.ms, 24 * 3_600_000), label };
}

/* ───────────── Countdowns ───────────── */

function parseCountdownCommand(text: string, lower: string, now: Date): Command | null {
  if (/\b(welche|meine|zeig\w*|liste)\b.*\bcountdowns?\b/.test(lower)) return { kind: "listCountdowns" };

  // Speichern: „Countdown: Urlaub am 1. Juli“, „Neuer Countdown für Mamas Geburtstag am 3.5.“
  const save = text.match(/^(?:erstelle\s+(?:einen\s+)?|starte\s+(?:einen\s+)?|neuer\s+)?countdown\s*[:\-]?\s*(.+)$/i);
  if (save) {
    const parsed = parseDateExpr(save[1], now);
    if (parsed) {
      const title = parsed.rest
        .replace(/^(bis|für|zum|zur|zu)\b\s*/i, "")
        .replace(/\s+(am|zum|bis|den|dem|ab)$/i, "")
        .replace(/[.!?:]+$/, "")
        .trim();
      const fallback = parsed.label.replace(/^zum\s+/, "");
      return {
        kind: "addCountdown",
        title: title ? title.charAt(0).toUpperCase() + title.slice(1) : fallback.charAt(0).toUpperCase() + fallback.slice(1),
        date: parsed.date,
      };
    }
  }

  // Fragen: „Wie viele Tage bis Weihnachten?“, „Wie lange noch bis zum 1. Juli?“
  const question = lower.match(
    /\b(?:wie\s+(?:viele|lange|oft)(?:\s+(?:tage|wochen|noch|schlafen|mal schlafen))*|tage|countdown)\b.*?\bbis\b\s*(?:zu[mr]?\s+|zu\s+(?:meine[mr]?|unsere[mr]?)\s+)?(.+)$/,
  );
  if (question) {
    const target = question[1]
      .replace(/[?.!]+$/, "")
      .replace(/^(meine[mnrs]?|unsere[mnrs]?|deine[mnrs]?|de[mnr]|die|das)\s+/, "")
      .trim();
    const parsed = parseDateExpr(target, now);
    if (parsed) return { kind: "countdownQuery", date: parsed.date, label: parsed.label };
    return { kind: "countdownQuery", label: target };
  }
  return null;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Beschreibt einen Zeitpunkt freundlich: „heute um 15:30“, „morgen um 09:00“. */
export function describeWhen(date: Date, now: Date = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(date) - startOf(now)) / 86_400_000);
  const time = formatTime(date);
  if (diffDays === 0) return `heute um ${time} Uhr`;
  if (diffDays === 1) return `morgen um ${time} Uhr`;
  if (diffDays === 2) return `übermorgen um ${time} Uhr`;
  return `am ${date.toLocaleDateString("de-DE", { day: "numeric", month: "long" })} um ${time} Uhr`;
}

export function greetingFor(date: Date, name: string): string {
  const h = date.getHours();
  const part =
    h < 5 ? "Gute Nacht" : h < 11 ? "Guten Morgen" : h < 17 ? "Guten Tag" : h < 22 ? "Guten Abend" : "Gute Nacht";
  return name ? `${part}, ${name}.` : `${part}.`;
}
