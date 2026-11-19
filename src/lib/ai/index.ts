import { timingSafeEqual } from "node:crypto";
import { createClaudeProvider } from "./claude";
import { createGroqProvider } from "./groq";
import { localProvider } from "./local";
import type { AiProvider } from "./provider";

/**
 * Wählt das passende Gehirn anhand der Umgebungsvariablen (nur auf dem Server):
 *
 *  - Groq: aktiv, sobald GROQ_API_KEY gesetzt ist (Standard).
 *  - Claude (Anthropic): nur mit JARVIS_AI_PROVIDER=claude, ANTHROPIC_API_KEY und
 *    JARVIS_ACCESS_CODE. Fehlt etwas davon, wird stattdessen Groq bzw. das lokale Gehirn genutzt.
 *  - Sonst: das kostenlose lokale Gehirn.
 *
 * JARVIS_AI_PROVIDER=local erzwingt das lokale Gehirn.
 */
export function getProvider(): AiProvider {
  const wanted = (process.env.JARVIS_AI_PROVIDER ?? "").trim().toLowerCase();
  if (wanted === "local") return localProvider;

  if (wanted === "claude") {
    if (process.env.ANTHROPIC_API_KEY && getAccessCode()) return createClaudeProvider();
    console.warn("[JARVIS] Claude ist nicht vollständig eingerichtet (Schlüssel + Zugangscode) – nutze Groq bzw. lokales Gehirn.");
  }

  if (process.env.GROQ_API_KEY?.trim()) return createGroqProvider();
  if (wanted === "groq") console.warn("[JARVIS] JARVIS_AI_PROVIDER=groq, aber GROQ_API_KEY fehlt – nutze lokales Gehirn.");
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
