import { createClaudeProvider } from "./claude";
import { localProvider } from "./local";
import type { AiProvider } from "./provider";

/**
 * Wählt das passende Gehirn anhand der Umgebungsvariablen.
 * Fehlt der Schlüssel, nutzt JARVIS automatisch das lokale Gehirn.
 */
export function getProvider(): AiProvider {
  const wanted = (process.env.JARVIS_AI_PROVIDER ?? "local").toLowerCase();
  if (wanted === "claude" && process.env.ANTHROPIC_API_KEY) {
    return createClaudeProvider();
  }
  return localProvider;
}

export { localProvider };
export type { AiProvider, AiContext } from "./provider";
