import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider } from "./provider";

/**
 * Claude-Gehirn (Anthropic). Wird nur aktiv, wenn
 *   JARVIS_AI_PROVIDER=claude  und  ANTHROPIC_API_KEY  gesetzt sind.
 * Der Schlüssel bleibt immer auf dem Server und erreicht nie den Browser.
 */

const DEFAULT_MODEL = "claude-opus-5-5";

function systemPrompt(userName: string | undefined, now: Date): string {
  return [
    "Du bist JARVIS, ein eleganter, höflicher und leicht humorvoller persönlicher KI-Assistent – inspiriert von JARVIS aus Iron Man.",
    "Antworte immer auf Deutsch und sieze die Nutzerin, sofern sie nichts anderes wünscht.",
    "Deine Antworten werden oft vorgelesen: Antworte kurz und natürlich (meist 1–3 Sätze), ohne Markdown, Listen oder Emojis.",
    "Aufgaben und Erinnerungen werden von der App selbst verwaltet. Wenn jemand etwas notieren möchte, erkläre die Formulierung „Erinnere mich um 15 Uhr an …“ oder „Neue Aufgabe: …“.",
    "Bank- und Lexware-Verbindungen sind noch nicht verfügbar.",
    userName ? `Die Nutzerin heißt ${userName}.` : "",
    `Aktueller Zeitpunkt (Server): ${now.toISOString()}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function createClaudeProvider(): AiProvider {
  const client = new Anthropic(); // liest ANTHROPIC_API_KEY aus der Umgebung
  const model = process.env.JARVIS_CLAUDE_MODEL || DEFAULT_MODEL;

  return {
    name: "claude",
    async reply(messages, context) {
      const response = await client.beta.messages.create({
        model,
        max_tokens: 2000,
        system: systemPrompt(context.userName, context.now),
        output_config: { effort: "low" }, // kurze Chat-Antworten → schnell & günstig
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: messages.map((m) => ({ role: m.role, content: m.text })),
      });

      if (response.stop_reason === "refusal") {
        return "Dazu kann ich leider nichts sagen. Kann ich Ihnen anders helfen?";
      }
      const text = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();
      return text || "Entschuldigung, ich habe gerade keine Antwort erhalten.";
    },
  };
}
