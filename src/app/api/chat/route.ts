import { NextResponse } from "next/server";
import { getAccessCode, getProvider, isAccessCodeValid, type AiContext } from "@/lib/ai";
import type { ChatApiMessage, ChatApiStatus, TaskSummary } from "@/lib/types";

/**
 * Server-Schnittstelle für den Chat.
 *   GET  /api/chat → Status (welches Gehirn, ob ein Zugangscode nötig ist)
 *   POST /api/chat → Antwort von JARVIS, als Text-Stream (erscheint Wort für Wort)
 * Läuft ausschließlich auf dem Server – hier dürfen geheime Schlüssel genutzt werden.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 30;
const MAX_TEXT_LENGTH = 4000;
const MAX_TASKS = 30;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

function validate(body: unknown): { messages: ChatApiMessage[]; context: AiContext } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages) || b.messages.length === 0) return null;

  const messages: ChatApiMessage[] = [];
  for (const m of b.messages.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== "object") return null;
    const { role, text } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof text !== "string") return null;
    const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
    if (trimmed) messages.push({ role, text: trimmed });
  }
  // Claude erwartet, dass der Verlauf mit einer Nutzer-Nachricht beginnt und endet
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;

  let tasks: TaskSummary[] | undefined;
  if (Array.isArray(b.tasks)) {
    tasks = b.tasks
      .slice(0, MAX_TASKS)
      .map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        return { title: str(o.title, 200) ?? "", remindAt: str(o.remindAt, 80) };
      })
      .filter((t) => t.title);
  }

  return {
    messages,
    context: {
      userName: str(b.userName, 60),
      localTime: str(b.localTime, 80),
      timeZone: str(b.timeZone, 60),
      tasks,
      memories: Array.isArray(b.memories)
        ? b.memories
            .slice(0, 30)
            .map((m) => str(m, 200))
            .filter((m): m is string => Boolean(m))
        : undefined,
    },
  };
}

function textStream(
  chunks: AsyncIterable<string>,
  onError: (alreadySent: boolean) => AsyncIterable<string>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      let sent = false;
      try {
        for await (const chunk of chunks) {
          sent = true;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        console.error("[JARVIS] KI-Antwort fehlgeschlagen:", error);
        for await (const chunk of onError(sent)) controller.enqueue(encoder.encode(chunk));
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(request: Request) {
  // Die KI-Schlüssel (z. B. GROQ_API_KEY) liegen ausschließlich auf dem Server.
  // Ist bei Netlify ein Zugangscode (JARVIS_ACCESS_CODE) gesetzt, muss JARVIS ihn mitschicken.
  if (!isAccessCodeValid(request.headers.get("x-jarvis-code"))) {
    return NextResponse.json({ error: "access_code" }, { status: 401 });
  }

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
  const stream = textStream(provider.stream(input.messages, input.context), async function* (alreadySent) {
    if (alreadySent) {
      yield " … Entschuldigung, die Verbindung zu meinem KI-Modul wurde unterbrochen.";
      return;
    }
    yield "Mein KI-Modul ist gerade nicht erreichbar. Bitte versuchen Sie es in einem Moment noch einmal. Aufgaben, Erinnerungen und die Uhrzeit funktionieren weiterhin.";
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Jarvis-Provider": provider.name,
    },
  });
}

export function GET() {
  return NextResponse.json<ChatApiStatus>({
    status: "online",
    provider: getProvider().name,
    accessCodeRequired: Boolean(getAccessCode()),
  });
}
