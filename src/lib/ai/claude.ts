import Anthropic from "@anthropic-ai/sdk";
import type { AiContext, AiProvider } from "./provider";

/**
 * Claude-Gehirn (Anthropic). Wird nur aktiv, wenn auf dem Server
 *   JARVIS_AI_PROVIDER=claude, ANTHROPIC_API_KEY und JARVIS_ACCESS_CODE
 * gesetzt sind. Der Schlüssel bleibt immer auf dem Server und erreicht nie den Browser.
 */

const DEFAULT_MODEL = "claude-opus-5-5";

/** Feste Persönlichkeit von JARVIS. */
const PERSONA = [
  "Du bist JARVIS, ein eleganter, höflicher und leicht humorvoller persönlicher KI-Assistent – inspiriert von JARVIS aus Iron Man.",
  "Antworte auf Deutsch und sieze die Nutzerin, sofern sie nichts anderes wünscht.",
  "Deine Antworten werden oft laut vorgelesen. Antworte deshalb natürlich und gesprochen klingend, meist in ein bis drei Sätzen. Verwende kein Markdown, keine Aufzählungszeichen, keine Überschriften und keine Emojis. Wird ausdrücklich eine ausführliche Erklärung gewünscht, darfst du länger antworten – dann in gut lesbaren, kurzen Absätzen.",
  "Aufgaben und Erinnerungen verwaltet die App selbst – du kannst sie nicht anlegen, ändern oder löschen. Möchte die Nutzerin etwas notieren, nenne ihr die Formulierung „Neue Aufgabe: …“ oder „Erinnere mich um 15 Uhr an …“.",
  "Du hast keinen Internetzugriff und kennst keine aktuellen Nachrichten oder Wetterdaten. Sag das ehrlich, statt etwas zu erfinden.",
  "Bank- und Lexware-Verbindungen sind noch nicht verfügbar.",
].join("\n");

function contextPrompt(ctx: AiContext): string {
  const lines: string[] = [];
  if (ctx.userName) lines.push(`Die Nutzerin heißt ${ctx.userName}.`);
  if (ctx.localTime) {
    lines.push(`Aktuelle Zeit bei der Nutzerin: ${ctx.localTime}${ctx.timeZone ? ` (Zeitzone ${ctx.timeZone})` : ""}.`);
  }
  if (ctx.tasks?.length) {
    const list = ctx.tasks.map((t) => `- ${t.title}${t.remindAt ? ` (Erinnerung ${t.remindAt})` : ""}`).join("\n");
    lines.push(`Offene Aufgaben der Nutzerin:\n${list}`);
  } else if (ctx.tasks) {
    lines.push("Die Nutzerin hat derzeit keine offenen Aufgaben.");
  }
  return lines.join("\n");
}

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
