import { describe, expect, it } from "vitest";
import { daysUntil, describeCountdown, easterSunday, formatClock, formatDuration, parseDateExpr, parseDuration } from "./chrono";
import { parseCommand } from "./commands";

// Mittwoch, 18.11.2026, 14:00 Uhr
const NOW = new Date(2026, 10, 18, 14, 0, 0);
const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()];

describe("Dauern", () => {
  it.each([
    ["5 Minuten", 5 * 60_000],
    ["1 Stunde 30 Minuten", 90 * 60_000],
    ["eine halbe Stunde", 30 * 60_000],
    ["90 Sekunden", 90_000],
    ["2,5 Minuten", 150_000],
    ["einer Minute", 60_000],
    ["zehn Minuten", 600_000],
    ["anderthalb Stunden", 90 * 60_000],
  ])("%s", (text, ms) => {
    expect(parseDuration(text)?.ms).toBe(ms);
  });

  it("ohne Zeitangabe → null", () => {
    expect(parseDuration("für die Nudeln")).toBeNull();
  });

  it("formatiert zum Vorlesen und Anzeigen", () => {
    expect(formatDuration(90 * 60_000)).toBe("1 Stunde und 30 Minuten");
    expect(formatDuration(65_000)).toBe("1 Minute und 5 Sekunden");
    expect(formatClock(272_000)).toBe("04:32");
    expect(formatClock(3_725_000)).toBe("1:02:05");
  });
});

describe("Daten", () => {
  it("Ostern 2027 ist am 28. März", () => {
    expect(ymd(easterSunday(2027))).toEqual([2027, 3, 28]);
    expect(ymd(easterSunday(2026))).toEqual([2026, 4, 5]);
  });

  it.each([
    ["Weihnachten", [2026, 12, 24]],
    ["Silvester", [2026, 12, 31]],
    ["Ostern", [2027, 3, 28]], // dieses Jahr schon vorbei → nächstes Jahr
    ["den 24.12.", [2026, 12, 24]],
    ["1. Juli", [2027, 7, 1]],
    ["15. März 2028", [2028, 3, 15]],
    ["3.5.27", [2027, 5, 3]],
    ["Freitag", [2026, 11, 20]],
    ["morgen", [2026, 11, 19]],
  ])("%s", (text, expected) => {
    const parsed = parseDateExpr(text, NOW);
    expect(parsed && ymd(parsed.date)).toEqual(expected);
  });

  it("zählt Kalendertage", () => {
    expect(daysUntil(new Date(2026, 11, 24), NOW)).toBe(36);
  });

  it("formuliert Countdowns", () => {
    expect(describeCountdown("Weihnachten", new Date(2026, 11, 24), NOW)).toBe(
      "Bis Weihnachten sind es noch 36 Tage, also 5 Wochen und 1 Tag. Das ist Donnerstag, 24. Dezember.",
    );
    expect(describeCountdown("zum 19. November", new Date(2026, 10, 19), NOW)).toMatch(/morgen ist es so weit/);
    expect(describeCountdown("zum 18. November", new Date(2026, 10, 18), NOW)).toBe("Der 18. November ist heute!");
  });
});

describe("Timer-Befehle", () => {
  it("stellt einen Timer", () => {
    expect(parseCommand("Stell einen Timer auf 5 Minuten", NOW)).toEqual({
      kind: "startTimer",
      durationMs: 300_000,
      label: "Timer",
    });
  });

  it("erkennt eine Bezeichnung", () => {
    expect(parseCommand("Timer für die Nudeln auf 8 Minuten", NOW)).toMatchObject({ label: "Nudeln", durationMs: 480_000 });
    expect(parseCommand("Starte einen Timer von 10 Minuten für den Kuchen", NOW)).toMatchObject({
      label: "Kuchen",
      durationMs: 600_000,
    });
  });

  it("versteht „Weck mich in …“", () => {
    expect(parseCommand("Weck mich in 20 Minuten", NOW)).toMatchObject({ kind: "startTimer", durationMs: 1_200_000 });
  });

  it("stoppt und fragt nach dem Status", () => {
    expect(parseCommand("Timer stoppen", NOW)).toEqual({ kind: "cancelTimer" });
    expect(parseCommand("Brich den Timer ab", NOW)).toEqual({ kind: "cancelTimer" });
    expect(parseCommand("Wie lange läuft der Timer noch?", NOW)).toEqual({ kind: "timerStatus" });
  });

  it("verwechselt Erinnerungen nicht mit Timern", () => {
    expect(parseCommand("Erinnere mich in 5 Minuten an den Tee", NOW)).toMatchObject({ kind: "addTask" });
  });
});

describe("Countdown-Befehle", () => {
  it("beantwortet „Wie viele Tage bis …“", () => {
    const cmd = parseCommand("Wie viele Tage bis Weihnachten?", NOW);
    expect(cmd).toMatchObject({ kind: "countdownQuery", label: "Weihnachten" });
    const cmd2 = parseCommand("Wie lange noch bis zum 1. Juli?", NOW);
    expect(cmd2).toMatchObject({ kind: "countdownQuery", label: "zum 1. Juli 2027" });
  });

  it("gibt unbekannte Ziele weiter (z. B. gespeicherte Countdowns)", () => {
    expect(parseCommand("Wie viele Tage noch bis zu meinem Urlaub?", NOW)).toEqual({
      kind: "countdownQuery",
      label: "urlaub",
    });
  });

  it("speichert Countdowns", () => {
    const cmd = parseCommand("Countdown: Urlaub am 1. Juli", NOW);
    expect(cmd).toMatchObject({ kind: "addCountdown", title: "Urlaub" });
    if (cmd?.kind !== "addCountdown") throw new Error();
    expect(ymd(cmd.date)).toEqual([2027, 7, 1]);
    expect(parseCommand("Neuer Countdown bis Weihnachten", NOW)).toMatchObject({ kind: "addCountdown", title: "Weihnachten" });
  });

  it("listet Countdowns", () => {
    expect(parseCommand("Welche Countdowns habe ich?", NOW)).toEqual({ kind: "listCountdowns" });
  });
});
