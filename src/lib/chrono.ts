/**
 * Zeit-Logik für Timer und Countdowns:
 *  - Dauern verstehen:   „5 Minuten“, „1 Stunde 30 Minuten“, „eine halbe Stunde“
 *  - Daten verstehen:    „Weihnachten“, „24.12.“, „1. Juli 2027“, „Freitag“, „Ostern“
 *  - Tage zählen und freundlich formulieren
 * Reine Logik ohne Browser – dadurch gut testbar.
 */

const DAY = 86_400_000;

/* ─────────────────────────── Dauern ─────────────────────────── */

const WORD_NUMBERS: Record<string, number> = {
  ein: 1, eine: 1, einen: 1, einer: 1, einem: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6,
  sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, fünfzehn: 15, zwanzig: 20,
  dreißig: 30, vierzig: 40, fünfzig: 50, sechzig: 60, neunzig: 90, anderthalb: 1.5, eineinhalb: 1.5,
};

const UNIT_MS: [RegExp, number][] = [
  [/^(stunden?|std|h)$/, 3_600_000],
  [/^(minuten?|min|m)$/, 60_000],
  [/^(sekunden?|sek|s)$/, 1000],
];

function unitMs(word: string): number | undefined {
  const w = word.toLowerCase();
  return UNIT_MS.find(([re]) => re.test(w))?.[1];
}

/**
 * Findet alle Zeitangaben im Text und addiert sie.
 * Gibt die Dauer in Millisekunden und den Text-Rest (ohne Zeitangaben) zurück.
 */
export function parseDuration(text: string): { ms: number; rest: string } | null {
  let ms = 0;
  const re =
    /(?:\b(eine[rnm]?|ein)\s+)?\b(halbe[n]?|viertel|\d+(?:[.,]\d+)?|[a-zäöüß]+)\s+(stunden?|std|minuten?|min|sekunden?|sek)\b/gi;
  const rest = text.replace(re, (match, _article: string | undefined, amountRaw: string, unitRaw: string) => {
    const unit = unitMs(unitRaw);
    const a = amountRaw.toLowerCase();
    const amount =
      a.startsWith("halbe") ? 0.5 : a === "viertel" ? 0.25 : (WORD_NUMBERS[a] ?? Number(a.replace(",", ".")));
    if (!unit || !Number.isFinite(amount)) return match;
    ms += amount * unit;
    return " ";
  });
  // „und eine halbe“ nach einer Stunde: „1 Stunde und eine halbe“ – selten, daher nicht unterstützt
  if (ms <= 0) return null;
  return { ms: Math.round(ms), rest: rest.replace(/\s+/g, " ").trim() };
}

/** „1 Stunde und 30 Minuten“, „45 Sekunden“ – zum Vorlesen. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? "Stunde" : "Stunden"}`);
  if (m) parts.push(`${m} ${m === 1 ? "Minute" : "Minuten"}`);
  if (s && h === 0) parts.push(`${s} ${s === 1 ? "Sekunde" : "Sekunden"}`);
  if (!parts.length) return "0 Sekunden";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} und ${parts.at(-1)}`;
}

/** „04:32“ bzw. „1:04:32“ – für die Anzeige. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/* ─────────────────────────── Daten ─────────────────────────── */

const MONTHS: [RegExp, number][] = [
  [/^jan(uar)?$/, 0], [/^feb(ruar)?$/, 1], [/^(märz|maerz|mär|mar)$/, 2], [/^apr(il)?$/, 3],
  [/^mai$/, 4], [/^jun[i]?$/, 5], [/^jul[i]?$/, 6], [/^aug(ust)?$/, 7], [/^sep(t|tember)?$/, 8],
  [/^okt(ober)?$/, 9], [/^nov(ember)?$/, 10], [/^dez(ember)?$/, 11],
];
const MONTH_PATTERN =
  "januar|jan|februar|feb|märz|maerz|mär|april|apr|mai|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|dezember|dez";

const WEEKDAYS = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Kalendertage von heute bis zum Datum (negativ = vorbei). */
export function daysUntil(date: Date, now: Date): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY);
}

/** Ostersonntag (Gaußsche Osterformel, gregorianischer Kalender). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

/** Feiertage & besondere Tage: Name → Datum in einem bestimmten Jahr. */
const SPECIAL_DAYS: { pattern: RegExp; label: string; date: (year: number) => Date }[] = [
  { pattern: /\bheilig(abend|en abend)\b/, label: "Heiligabend", date: (y) => new Date(y, 11, 24) },
  { pattern: /\bweihnacht(en|sfest)?\b/, label: "Weihnachten", date: (y) => new Date(y, 11, 24) },
  { pattern: /\bsilvester\b/, label: "Silvester", date: (y) => new Date(y, 11, 31) },
  { pattern: /\bneujahr\b/, label: "Neujahr", date: (y) => new Date(y, 0, 1) },
  { pattern: /\bvalentinstag\b/, label: "Valentinstag", date: (y) => new Date(y, 1, 14) },
  { pattern: /\bhalloween\b/, label: "Halloween", date: (y) => new Date(y, 9, 31) },
  { pattern: /\bnikolaus(tag)?\b/, label: "Nikolaus", date: (y) => new Date(y, 11, 6) },
  { pattern: /\b(tag der deutschen einheit)\b/, label: "zum Tag der Deutschen Einheit", date: (y) => new Date(y, 9, 3) },
  { pattern: /\bkarfreitag\b/, label: "Karfreitag", date: (y) => new Date(easterSunday(y).getTime() - 2 * DAY) },
  { pattern: /\bostern\b/, label: "Ostern", date: (y) => easterSunday(y) },
  { pattern: /\bpfingsten\b/, label: "Pfingsten", date: (y) => new Date(easterSunday(y).getTime() + 49 * DAY) },
  { pattern: /\bmuttertag\b/, label: "zum Muttertag", date: (y) => nthWeekdayOfMonth(y, 4, 0, 2) },
  { pattern: /\b(sommeranfang|sommer)\b/, label: "zum Sommeranfang", date: (y) => new Date(y, 5, 21) },
  { pattern: /\b(frühlingsanfang|frühling)\b/, label: "zum Frühlingsanfang", date: (y) => new Date(y, 2, 20) },
  { pattern: /\b(herbstanfang|herbst)\b/, label: "zum Herbstanfang", date: (y) => new Date(y, 8, 23) },
  { pattern: /\b(winteranfang|winter)\b/, label: "zum Winteranfang", date: (y) => new Date(y, 11, 21) },
];

/** Nächstes Vorkommen (heute zählt mit): dieses Jahr, sonst nächstes Jahr. */
function nextOccurrence(make: (year: number) => Date, now: Date): Date {
  const thisYear = make(now.getFullYear());
  return daysUntil(thisYear, now) >= 0 ? thisYear : make(now.getFullYear() + 1);
}

function fullYear(y: string | undefined): number | undefined {
  if (!y) return undefined;
  const n = Number(y);
  return y.length <= 2 ? 2000 + n : n;
}

function validDate(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month, day);
  return d.getMonth() === month && d.getDate() === day ? d : null;
}

export interface ParsedDate {
  date: Date;
  /** Für Sätze wie „Bis {label} sind es …“ – z. B. „Weihnachten“ oder „zum 1. Juli“ */
  label: string;
  /** Text ohne die Datumsangabe */
  rest: string;
}

/** Erkennt ein Datum in freiem Text. */
export function parseDateExpr(input: string, now: Date): ParsedDate | null {
  const text = input.toLowerCase();
  const restOf = (matched: string) =>
    input
      .replace(new RegExp(matched.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")
      .replace(/\s+/g, " ")
      .trim();

  for (const special of SPECIAL_DAYS) {
    const m = text.match(special.pattern);
    if (m) return { date: nextOccurrence(special.date, now), label: special.label, rest: restOf(m[0]) };
  }

  if (/\bübermorgen\b/.test(text)) {
    return { date: startOfDay(new Date(now.getTime() + 2 * DAY)), label: "übermorgen", rest: restOf("übermorgen") };
  }
  if (/\bmorgen\b/.test(text)) {
    return { date: startOfDay(new Date(now.getTime() + DAY)), label: "morgen", rest: restOf("morgen") };
  }

  // 24.12.2026 · 24.12.26 · 24.12. · 2026-12-24
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const numeric = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?!\d)/);
  // 1. Juli 2027 · 1 Juli · 15. März
  const named = text.match(new RegExp(`\\b(\\d{1,2})\\.?\\s*(${MONTH_PATTERN})\\.?(?:\\s+(\\d{4}))?\\b`));

  let day: number | undefined, month: number | undefined, year: number | undefined, matched = "";
  if (iso) {
    [year, month, day, matched] = [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), iso[0]];
  } else if (numeric) {
    [day, month, year, matched] = [Number(numeric[1]), Number(numeric[2]) - 1, fullYear(numeric[3]), numeric[0]];
  } else if (named) {
    const monthIndex = MONTHS.find(([re]) => re.test(named[2]))?.[1];
    if (monthIndex !== undefined) {
      [day, month, year, matched] = [Number(named[1]), monthIndex, fullYear(named[3]), named[0]];
    }
  }

  if (day !== undefined && month !== undefined) {
    const make = (y: number) => validDate(y, month!, day!) ?? new Date(NaN);
    const date = year !== undefined ? make(year) : nextOccurrence(make, now);
    if (!Number.isNaN(date.getTime())) {
      const showYear = date.getFullYear() !== now.getFullYear();
      const label = `zum ${date.toLocaleDateString("de-DE", { day: "numeric", month: "long", ...(showYear ? { year: "numeric" } : {}) })}`;
      return { date, label, rest: restOf(matched) };
    }
  }

  // „bis Freitag“ → nächster Freitag (heute zählt nicht, sonst wäre es 0 Tage)
  const weekday = WEEKDAYS.findIndex((w) => new RegExp(`\\b${w}\\b`).test(text));
  if (weekday >= 0) {
    const diff = ((weekday - now.getDay() + 7) % 7) || 7;
    const date = startOfDay(new Date(now.getTime() + diff * DAY));
    const name = WEEKDAYS[weekday];
    return { date, label: name.charAt(0).toUpperCase() + name.slice(1), rest: restOf(name) };
  }

  return null;
}

/** Freundlicher Satz für einen Countdown. */
export function describeCountdown(label: string, date: Date, now: Date): string {
  const days = daysUntil(date, now);
  const when = date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  const cap = label.charAt(0).toUpperCase() + label.slice(1);
  if (days < 0) {
    const ago = -days;
    return `${cap.replace(/^Zum /, "Der ")} war vor ${ago} ${ago === 1 ? "Tag" : "Tagen"}.`;
  }
  if (days === 0) return `${cap.replace(/^Zum /, "Der ")} ist heute!`;
  if (days === 1) return `Bis ${label} ist es nur noch ein Tag – morgen ist es so weit.`;
  let extra = "";
  if (days >= 14) {
    const weeks = Math.floor(days / 7);
    const rest = days % 7;
    extra = `, also ${weeks} Wochen${rest ? ` und ${rest} ${rest === 1 ? "Tag" : "Tage"}` : ""}`;
  }
  return `Bis ${label} sind es noch ${days} Tage${extra}. Das ist ${when}.`;
}
