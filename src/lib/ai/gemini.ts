import { ApiError, GoogleGenAI } from "@google/genai";
import { contextPrompt, PERSONA } from "./prompt";
import type { AiProvider } from "./provider";

/**
 * Gemini-Gehirn (Google) – mit kostenlosem Kontingent nutzbar.
 * Aktiv, sobald auf dem Server GEMINI_API_KEY gesetzt ist.
 * Der Schlüssel bleibt immer auf dem Server und erreicht nie das iPad/den Browser.
 *
 * Standardmodell: „gemini-flash-lite-latest“ – zeigt automatisch auf das neueste
 * Flash-Lite-Modell (schnell, großzügiges Gratis-Kontingent). Gibt es das nicht,
 * weicht JARVIS auf „gemini-flash-latest“ aus.
 */

const DEFAULT_MODEL = "gemini-flash-lite-latest";
const FALLBACK_MODEL = "gemini-flash-latest";

/**
 * Grobe Prüfung eines Gemini-Schlüssels. Bewusst großzügig: Google vergibt Schlüssel
 * in verschiedenen Formaten (z. B. „AIza…“) – ob er gültig ist, entscheidet Google.
 * Nur sichtbare ASCII-Zeichen (für den HTTP-Header), 10–300 Zeichen.
 */
export function looksLikeGeminiKey(key: string | null | undefined): key is string {
  return typeof key === "string" && /^[\x21-\x7E]{10,300}$/.test(key.trim());
}

/**
 * @param apiKey Optional: Schlüssel, den die Nutzerin direkt in JARVIS eingetragen hat.
 *               Sonst wird GEMINI_API_KEY vom Server verwendet.
 */
export function createGeminiProvider(apiKey?: string): AiProvider {
  const ai = new GoogleGenAI({
    apiKey: apiKey?.trim() || process.env.GEMINI_API_KEY,
    // nur für Tests: eigener Server statt Google
    ...(process.env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.GEMINI_BASE_URL } } : {}),
  });
  const preferred = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  return {
    name: "gemini",
    async *stream(messages, context) {
      const request = (model: string, withSearch: boolean) =>
        ai.models.generateContentStream({
          model,
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.text }],
          })),
          config: {
            systemInstruction: `${PERSONA}\n${contextPrompt({ ...context, webSearch: withSearch })}`,
            temperature: 0.7,
            maxOutputTokens: 1000,
            ...(withSearch ? { tools: [{ googleSearch: {} }] } : {}),
          },
        });

      // Erst mit Google-Suche versuchen; lehnt das Modell die Suche ab (400), ohne Suche.
      const requestWithFallback = async (model: string) => {
        try {
          return await request(model, true);
        } catch (error) {
          if (error instanceof ApiError && error.status === 400) {
            console.warn("[JARVIS] Gemini-Suche nicht verfügbar – antworte ohne Suche.");
            return request(model, false);
          }
          throw error;
        }
      };

      let response;
      try {
        response = await requestWithFallback(preferred);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404 && preferred !== FALLBACK_MODEL) {
          console.warn(`[JARVIS] Gemini-Modell „${preferred}“ nicht gefunden – nutze ${FALLBACK_MODEL}.`);
          response = await requestWithFallback(FALLBACK_MODEL).catch(handleKnownError);
        } else {
          response = handleKnownError(error);
        }
      }
      if (typeof response === "string") {
        yield response;
        return;
      }

      let produced = false;
      for await (const chunk of response) {
        const text = chunk.text;
        if (text) {
          produced = true;
          yield text;
        }
      }
      if (!produced) yield "Dazu kann ich leider nichts sagen. Kann ich Ihnen anders helfen?";
    },
  };
}

/** Bekannte Fehler in verständliche Sätze übersetzen, alle anderen weiterreichen. */
function handleKnownError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return "Mein kostenloses KI-Kontingent ist gerade aufgebraucht. Bitte versuchen Sie es in einer Minute – oder spätestens morgen – noch einmal. Timer, Aufgaben und Erinnerungen funktionieren weiterhin.";
    }
    if (error.status === 400 || error.status === 401 || error.status === 403) {
      console.error("[JARVIS] Gemini lehnt den Schlüssel ab:", error.message);
      return "Mein Gemini-Schlüssel wird nicht akzeptiert. Bitte prüfen Sie ihn unter Einstellungen → KI-Schlüssel (ganz kopiert, ohne Leerzeichen?).";
    }
  }
  throw error;
}
