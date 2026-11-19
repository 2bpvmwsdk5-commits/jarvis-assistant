import { contextPrompt, PERSONA } from "./prompt";
import type { AiProvider } from "./provider";

/**
 * Groq-Gehirn – OpenAI-kompatible Schnittstelle unter https://api.groq.com/openai/v1
 *
 * Aktiv, sobald auf dem Server (Netlify) die Umgebungsvariable GROQ_API_KEY gesetzt ist.
 * Der Schlüssel wird NUR hier auf dem Server gelesen und nie an den Browser geschickt.
 *
 * Modelle: zuerst „openai/gpt-oss-120b“, bei Nichtverfügbarkeit „openai/gpt-oss-20b“.
 * Mit GROQ_MODEL lässt sich ein anderes Modell festlegen (z. B. wenn Groq Modelle ändert).
 */

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_DEFAULT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

/** Nur für automatische Tests kann die Adresse umgeleitet werden. */
const baseUrl = () => process.env.JARVIS_GROQ_BASE_URL || GROQ_BASE_URL;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

class GroqHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Liest die Fehlermeldung von Groq (OpenAI-Format: { error: { message, code } }). */
async function readError(res: Response): Promise<GroqHttpError> {
  let code = "";
  let message = `HTTP ${res.status}`;
  try {
    const data = (await res.json()) as { error?: { message?: string; code?: string; type?: string } };
    code = data.error?.code ?? data.error?.type ?? "";
    message = data.error?.message ?? message;
  } catch {
    /* kein JSON */
  }
  return new GroqHttpError(res.status, code, message);
}

/** Modell existiert nicht (mehr) bzw. ist für dieses Konto nicht freigeschaltet → nächstes Modell. */
function isModelUnavailable(e: GroqHttpError): boolean {
  return (
    e.status === 404 ||
    /model_not_found|model_decommissioned|model_not_active|model_terms_required/.test(e.code) ||
    (e.status === 400 && /model/i.test(e.message) && /(not exist|decommission|not found|not available|access)/i.test(e.message))
  );
}

/** Liest einen OpenAI-kompatiblen Server-Sent-Events-Stream und liefert die Textstücke. */
async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      let parsed: { choices?: { delta?: { content?: string | null } }[]; error?: { message?: string } };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (parsed.error) throw new Error(parsed.error.message ?? "Groq-Fehler im Stream");
      const text = parsed.choices?.[0]?.delta?.content;
      if (text) yield text; // Denk-Schritte („reasoning“) werden bewusst nicht angezeigt
    }
  }
}

export function createGroqProvider(): AiProvider {
  const apiKey = process.env.GROQ_API_KEY?.trim() ?? "";
  const models = process.env.GROQ_MODEL?.trim() ? [process.env.GROQ_MODEL.trim()] : GROQ_DEFAULT_MODELS;

  /** Eine Anfrage an Groq. `tuned` = mit Feineinstellungen für gpt-oss (kurz denken, Denken ausblenden). */
  const request = (model: string, messages: ChatMessage[], tuned: boolean) =>
    fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.7,
        max_completion_tokens: 1500,
        ...(tuned && model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    });

  return {
    name: "groq",
    async *stream(history, context) {
      const messages: ChatMessage[] = [
        { role: "system", content: `${PERSONA}\n${contextPrompt({ ...context, webSearch: false })}` },
        ...history.map((m) => ({ role: m.role, content: m.text })),
      ];

      let lastError: GroqHttpError | null = null;
      for (const model of models) {
        let res = await request(model, messages, true);
        // Lehnt Groq die Feineinstellungen ab (400), ohne sie wiederholen
        if (res.status === 400) {
          const err = await readError(res);
          if (isModelUnavailable(err)) {
            lastError = err;
            continue;
          }
          res = await request(model, messages, false);
        }
        if (!res.ok || !res.body) {
          const err = await readError(res);
          if (err.status === 401 || err.status === 403) {
            console.error("[JARVIS] Groq lehnt den Schlüssel ab:", err.message);
            yield "Mein KI-Schlüssel wird von Groq nicht akzeptiert. Bitte prüfen Sie die Umgebungsvariable GROQ_API_KEY bei Netlify.";
            return;
          }
          if (err.status === 429) {
            yield "Mein KI-Kontingent bei Groq ist gerade ausgeschöpft. Bitte versuchen Sie es in einer Minute noch einmal. Timer, Aufgaben und Erinnerungen funktionieren weiterhin.";
            return;
          }
          if (isModelUnavailable(err)) {
            console.warn(`[JARVIS] Groq-Modell „${model}“ nicht verfügbar:`, err.message);
            lastError = err;
            continue;
          }
          throw err;
        }

        let produced = false;
        for await (const piece of readSse(res.body)) {
          produced = true;
          yield piece;
        }
        if (!produced) yield "Dazu kann ich leider nichts sagen. Kann ich Ihnen anders helfen?";
        return;
      }

      console.error("[JARVIS] Kein Groq-Modell verfügbar:", lastError?.message);
      yield "Das eingestellte Groq-Modell ist nicht verfügbar. Bitte bei Netlify mit GROQ_MODEL ein aktuelles Modell festlegen (siehe console.groq.com/docs/models).";
    },
  };
}
