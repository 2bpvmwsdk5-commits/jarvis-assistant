import type { ChatApiMessage, TaskSummary } from "@/lib/types";

/**
 * Ein „Gehirn“ für JARVIS. Jede KI (lokal, Claude, …) erfüllt diese Schnittstelle.
 * So kann das Gehirn später ausgetauscht werden, ohne den Rest der App anzufassen.
 */
export interface AiContext {
  userName?: string;
  /** Datum & Uhrzeit, wie sie auf dem Gerät der Nutzerin angezeigt werden */
  localTime?: string;
  timeZone?: string;
  /** Offene Aufgaben, damit die KI Fragen wie „Was steht heute an?“ beantworten kann */
  tasks?: TaskSummary[];
  /** Was sich JARVIS über die Nutzerin merken soll */
  memories?: string[];
  /** Vom Gehirn selbst gesetzt: Kann es im Internet suchen? */
  webSearch?: boolean;
}

export interface AiProvider {
  readonly name: string;
  /** Liefert die Antwort Stück für Stück (Streaming), damit sie sofort erscheint. */
  stream(messages: ChatApiMessage[], context: AiContext): AsyncIterable<string>;
}
