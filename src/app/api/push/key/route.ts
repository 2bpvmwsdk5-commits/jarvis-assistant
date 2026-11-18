import { NextResponse } from "next/server";
import { getVapidKeys } from "@/lib/push/send";
import { getKeyValueStore } from "@/lib/push/store";

/** GET /api/push/key → öffentlicher Schlüssel für das Abonnieren von Benachrichtigungen */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { publicKey } = await getVapidKeys(getKeyValueStore());
    return NextResponse.json({ publicKey });
  } catch (error) {
    console.error("[JARVIS] VAPID-Schlüssel:", error);
    return NextResponse.json({ error: "Benachrichtigungen sind auf dem Server nicht verfügbar." }, { status: 500 });
  }
}
