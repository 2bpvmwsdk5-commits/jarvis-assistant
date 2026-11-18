/** Gemeinsame Datentypen für JARVIS. */

export type CoreState = "idle" | "listening" | "thinking" | "speaking";

export interface ChatMessage {
  id: string;
  role: "user" | "jarvis";
  text: string;
  createdAt: string; // ISO-Datum
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  createdAt: string; // ISO-Datum
  remindAt?: string; // ISO-Datum – wenn gesetzt, ist es eine Erinnerung
  notified?: boolean; // Erinnerung wurde bereits ausgelöst
}

export interface Settings {
  userName: string;
  voiceEnabled: boolean;
  voiceName: string; // leer = automatisch beste deutsche Stimme
  speechRate: number; // 0.5 – 1.5
  speechPitch: number; // 0.5 – 1.5
  greetingEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  userName: "",
  voiceEnabled: true,
  voiceName: "",
  speechRate: 1,
  speechPitch: 1,
  greetingEnabled: true,
};

/** Nachricht, wie sie an die Server-Schnittstelle /api/chat geschickt wird. */
export interface ChatApiMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatApiRequest {
  messages: ChatApiMessage[];
  userName?: string;
}

export interface ChatApiResponse {
  reply: string;
  provider: string;
}
