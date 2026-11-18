/** Datentypen für Benachrichtigungen (Push) und den Morgenbericht – Server & Browser. */

export interface PushJob {
  id: string;
  kind: "reminder" | "timer";
  title: string;
  body: string;
  at: string; // ISO-Zeitpunkt, zu dem benachrichtigt wird
}

export interface BriefingSettings {
  enabled: boolean;
  time: string; // „HH:MM“ in der Ortszeit des Geräts
  city: string; // für das Wetter (leer = ohne Wetter)
}

export interface PushSubscriptionData {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

/** Was das Gerät an den Server schickt. */
export interface SyncPayload {
  deviceId: string;
  subscription?: PushSubscriptionData;
  timeZone: string;
  userName: string;
  jobs: PushJob[];
  briefing: BriefingSettings;
  tasks: { title: string; remindAt?: string }[];
  countdowns: { title: string; date: string }[];
}

/** Was der Server pro Gerät speichert. */
export interface DeviceRecord extends Omit<SyncPayload, "subscription"> {
  subscription: PushSubscriptionData | null;
  sentJobIds: string[];
  briefingState: {
    lastSentDate?: string; // „JJJJ-MM-TT“ in Ortszeit
    geo?: { city: string; lat: number; lon: number; label: string };
  };
  createdAt: string;
  updatedAt: string;
}

export interface PushMessage {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}
