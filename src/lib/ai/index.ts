import { timingSafeEqual } from "node:crypto";
import { createClaudeProvider } from "./claude";
import { localProvider } from "./local";
import type { AiProvider } from "./provider";

/**
 * Wählt das passende Gehirn anhand der Umgebungsvariablen.
 *
 * Claude wird nur genutzt, wenn ZUSÄTZLICH ein Zugangscode festgelegt ist.
 * So kann niemand, der nur die Internet-Adresse kennt, auf Ihre Kosten chatten.
 * Fehlt etwas, nutzt JARVIS automatisch das kostenlose lokale Gehirn.
 */
export function getProvider(): AiProvider {
  const wanted = (process.env.JARVIS_AI_PROVIDER ?? "local").toLowerCase();
  if (wanted === "claude") {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("[JARVIS] JARVIS_AI_PROVIDER=claude, aber ANTHROPIC_API_KEY fehlt – nutze lokales Gehirn.");
    } else if (!getAccessCode()) {
      console.warn("[JARVIS] Claude ist nur mit JARVIS_ACCESS_CODE erlaubt – nutze lokales Gehirn.");
    } else {
      return createClaudeProvider();
    }
  }
  return localProvider;
}

export function getAccessCode(): string {
  return (process.env.JARVIS_ACCESS_CODE ?? "").trim();
}

/** Vergleicht den Zugangscode zeitkonstant (schützt vor Rate-Angriffen über die Antwortzeit). */
export function isAccessCodeValid(given: string | null): boolean {
  const expected = getAccessCode();
  if (!expected) return true; // kein Code festgelegt → frei zugänglich (nur lokales Gehirn)
  if (!given) return false;
  const a = Buffer.from(given.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export { localProvider };
export type { AiProvider, AiContext } from "./provider";
