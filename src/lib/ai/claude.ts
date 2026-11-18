import Anthropic from "@anthropic-ai/sdk";
import { contextPrompt, PERSONA } from "./prompt";
import type { AiProvider } from "./provider";

/**
 * Claude-Gehirn (Anthropic). Wird nur aktiv, wenn auf dem Server
 *   JARVIS_AI_PROVIDER=claude, ANTHROPIC_API_KEY und JARVIS_ACCESS_CODE
 * gesetzt sind. Der Schlüssel bleibt immer auf dem Server und erreicht nie den Browser.
 */

const DEFAULT_MODEL = "claude-opus-5-5";

export function createClaudeProvider(): AiProvider {
  const client = new Anthropic(); // liest ANTHROPIC_API_KEY aus der Umgebung
  const model = process.env.JARVIS_CLAUDE_MODEL || DEFAULT_MODEL;

  return {
    name: "claude",
    async *stream(messages, context) {
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 4000,
        system: [
          { type: "text", text: PERSONA },
          { type: "text", text: contextPrompt(context) || "Keine weiteren Angaben." },
        ],
        output_config: { effort: "low" }, // Chat: schnelle, kurze Antworten
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default", // lehnt das Modell ab, übernimmt automatisch ein passendes Ersatzmodell
        messages: messages.map((m) => ({ role: m.role, content: m.text })),
      });

      let produced = false;
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          produced = true;
          yield event.delta.text;
        }
      }

      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal" && !produced) {
        yield "Dazu kann ich leider nichts sagen. Kann ich Ihnen anders helfen?";
      } else if (!produced) {
        yield "Entschuldigung, ich habe gerade keine Antwort erhalten.";
      }
    },
  };
}
