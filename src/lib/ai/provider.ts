import type { ChatApiMessage } from "@/lib/types";

/**
 * Ein „Gehirn“ für JARVIS. Jede KI (lokal, Claude, …) erfüllt diese Schnittstelle.
 * So kann das Gehirn später ausgetauscht werden, ohne den Rest der App anzufassen.
 */
export interface AiContext {
  userName?: string;
  now: Date;
}

export interface AiProvider {
  readonly name: string;
  reply(messages: ChatApiMessage[], context: AiContext): Promise<string>;
}
