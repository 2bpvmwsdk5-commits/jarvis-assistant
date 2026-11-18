import { describe, expect, it } from "vitest";
import { describeWhen, extractTime, greetingFor, parseCommand } from "./commands";
import { localAnswer } from "./ai/local";

// Fester Zeitpunkt: Mittwoch, 18.11.2026, 14:00 Uhr (lokale Zeit)
const NOW = new Date(2026, 10, 18, 14, 0, 0);

describe("parseCommand – Erinnerungen", () => {
  it("versteht eine Uhrzeit mit Minuten", () => {
    const cmd = parseCommand("Erinnere mich um 15:30 an den Anruf", NOW);
    expect(cmd).toMatchObject({ kind: "addTask", title: "Anruf" });
    if (cmd?.kind !== "addTask") throw new Error();
    expect(cmd.remindAt?.getHours()).toBe(15);
    expect(cmd.remindAt?.getMinutes()).toBe(30);
    expect(cmd.remindAt?.getDate()).toBe(18);
  });

  it("verschiebt eine vergangene Uhrzeit auf morgen", () => {
    const cmd = parseCommand("Erinnere mich um 9 Uhr an Sport", NOW);
    if (cmd?.kind !== "addTask") throw new Error();
    expect(cmd.title).toBe("Sport");
    expect(cmd.remindAt?.getDate()).toBe(19);
    expect(cmd.remindAt?.getHours()).toBe(9);
  });

  it("versteht „morgen um …“", () => {
    const cmd = parseCommand("erinnere mich morgen um 8.15 an den Zahnarzt", NOW);
    if (cmd?.kind !== "addTask") throw new Error();
    expect(cmd.title).toBe("Zahnarzt");
    expect(cmd.remindAt?.getDate()).toBe(19);
    expect(cmd.remindAt?.getMinutes()).toBe(15);
  });

  it("versteht relative Zeiten", () => {
    const cmd = parseCommand("Erinnere mich in 10 Minuten an den Tee", NOW);
    if (cmd?.kind !== "addTask") throw new Error();
    expect(cmd.title).toBe("Tee");
    expect(cmd.remindAt?.getTime()).toBe(NOW.getTime() + 10 * 60_000);
  });

  it("versteht ausgeschriebene Zahlen", () => {
    const cmd = parseCommand("Erinnere mich in einer Stunde daran, Mama anzurufen", NOW);
    if (cmd?.kind !== "addTask") throw new Error();
    expect(cmd.remindAt?.getTime()).toBe(NOW.getTime() + 3_600_000);
    expect(cmd.title).toContain("Mama anzurufen");
  });
});

describe("parseCommand – Aufgaben & Fragen", () => {
  it("legt eine Aufgabe an", () => {
    expect(parseCommand("Neue Aufgabe: Einkaufen gehen", NOW)).toEqual({
      kind: "addTask",
      title: "Einkaufen gehen",
      remindAt: undefined,
    });
  });

  it("versteht „Füge … zu meinen Aufgaben hinzu“", () => {
    expect(parseCommand("Füge Blumen gießen zu meinen Aufgaben hinzu", NOW)).toMatchObject({
      kind: "addTask",
      title: "Blumen gießen",
    });
  });

  it("erkennt Fragen nach Aufgaben, Uhrzeit, Datum und Hilfe", () => {
    expect(parseCommand("Welche Aufgaben habe ich?", NOW)).toEqual({ kind: "listTasks" });
    expect(parseCommand("Wie spät ist es?", NOW)).toEqual({ kind: "time" });
    expect(parseCommand("Welcher Tag ist heute?", NOW)).toEqual({ kind: "date" });
    expect(parseCommand("Was kannst du?", NOW)).toEqual({ kind: "help" });
  });

  it("gibt bei normalem Gespräch null zurück", () => {
    expect(parseCommand("Erzähl mir einen Witz", NOW)).toBeNull();
    expect(parseCommand("", NOW)).toBeNull();
  });
});

describe("Hilfsfunktionen", () => {
  it("extractTime ohne Zeitangabe", () => {
    expect(extractTime("an den Müll", NOW)).toEqual({ date: undefined, rest: "an den Müll" });
  });

  it("describeWhen", () => {
    expect(describeWhen(new Date(2026, 10, 18, 15, 30), NOW)).toBe("heute um 15:30 Uhr");
    expect(describeWhen(new Date(2026, 10, 19, 9, 0), NOW)).toBe("morgen um 09:00 Uhr");
  });

  it("greetingFor", () => {
    expect(greetingFor(new Date(2026, 0, 1, 8), "Lena")).toBe("Guten Morgen, Lena.");
    expect(greetingFor(new Date(2026, 0, 1, 19), "")).toBe("Guten Abend.");
  });
});

describe("Lokales Gehirn", () => {
  it("antwortet auf Begrüßungen", () => {
    expect(localAnswer("Hallo JARVIS", "Lena")).toMatch(/Lena/);
  });
  it("hat immer eine Antwort", () => {
    expect(localAnswer("Was ist der Sinn des Lebens?").length).toBeGreaterThan(10);
  });
});

describe("Gedächtnis", () => {
  it("merkt sich Dinge", () => {
    expect(parseCommand("Merke dir, dass ich Katzen mag.", NOW)).toEqual({ kind: "remember", fact: "ich Katzen mag" });
    expect(parseCommand("Merk dir: Mein Lieblingsessen ist Pasta", NOW)).toEqual({
      kind: "remember",
      fact: "Mein Lieblingsessen ist Pasta",
    });
  });

  it("fragt und vergisst", () => {
    expect(parseCommand("Was weißt du über mich?", NOW)).toEqual({ kind: "listMemory" });
    expect(parseCommand("Vergiss das mit den Katzen", NOW)).toEqual({ kind: "forget", query: "Katzen" });
    expect(parseCommand("Vergiss alles", NOW)).toEqual({ kind: "forget", query: "alles" });
  });

  it("„Notiere“ legt weiterhin Aufgaben an", () => {
    expect(parseCommand("Notiere Milch kaufen", NOW)).toMatchObject({ kind: "addTask", title: "Milch kaufen" });
  });
});
