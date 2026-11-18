import { NextResponse } from "next/server";
import { getProvider, localProvider } from "@/lib/ai";
import type { ChatApiMessage, ChatApiResponse } from "@/lib/types";

/**
 * Server-Schnittstelle: POST /api/chat
 * Nimmt den Chatverlauf entgegen und liefert die Antwort von JARVIS.
 * Läuft ausschließlich auf dem Server – hier dürfen geheime Schlüssel genutzt werden.
 */

export const runtime = "nodejs";

const MAX_MESSAGES = 30;
const MAX_TEXT_LENGTH = 4000;

function validate(body: unknown): { messages: ChatApiMessage[]; userName?: string } | null {
  if (!body || typeof body !== "object") return null;
  const { messages, userName } = body as Record<string, unknown>;
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const clean: ChatApiMessage[] = [];
  for (const m of messages.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== "object") return null;
    const { role, text } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof text !== "string") return null;
    const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
    if (trimmed) clean.push({ role, text: trimmed });
  }
  // Claude erwartet, dass der Verlauf mit einer Nutzer-Nachricht beginnt
  while (clean.length && clean[0].role !== "user") clean.shift();
  if (!clean.length || clean[clean.length - 1].role !== "user") return null;

  return {
    messages: clean,
    userName: typeof userName === "string" ? userName.slice(0, 60) : undefined,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const input = validate(body);
  if (!input) {
    return NextResponse.json({ error: "Ungültige Nachricht." }, { status: 400 });
  }

  const provider = getProvider();
  const context = { userName: input.userName, now: new Date() };

  try {
    const reply = await provider.reply(input.messages, context);
    return NextResponse.json<ChatApiResponse>({ reply, provider: provider.name });
  } catch (error) {
    // Fällt die externe KI aus, antwortet JARVIS trotzdem – mit dem lokalen Gehirn.
    console.error(`[JARVIS] KI-Anbieter „${provider.name}“ fehlgeschlagen:`, error);
    const reply = await localProvider.reply(input.messages, context);
    return NextResponse.json<ChatApiResponse>({ reply, provider: "local-fallback" });
  }
}

export function GET() {
  return NextResponse.json({ status: "online", provider: getProvider().name });
}
