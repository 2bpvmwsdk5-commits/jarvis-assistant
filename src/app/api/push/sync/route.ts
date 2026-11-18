import { NextResponse } from "next/server";
import { getKeyValueStore } from "@/lib/push/store";
import { deviceKey, saveDevice, validateDeviceId, validatePayload } from "@/lib/push/sync";

/**
 * POST   /api/push/sync → Gerät meldet Abo, Erinnerungen, Timer und Morgenbericht-Einstellungen
 * DELETE /api/push/sync → Gerät meldet sich ab
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Kein Zugangscode nötig: Benachrichtigungen kosten nichts, die Daten werden streng geprüft
  // und begrenzt, und Mitteilungen gehen nur an das Gerät, das sich selbst angemeldet hat.
  const payload = validatePayload(await request.json().catch(() => null));
  if (!payload) return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
  if (payload.subscriptionInvalid) {
    return NextResponse.json({ error: "Unbekannter Benachrichtigungsdienst." }, { status: 400 });
  }
  const record = await saveDevice(getKeyValueStore(), payload);
  return NextResponse.json({ ok: true, subscribed: Boolean(record.subscription), jobs: record.jobs.length });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { deviceId?: unknown } | null;
  const id = validateDeviceId(body?.deviceId);
  if (!id) return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
  await getKeyValueStore().delete(deviceKey(id));
  return NextResponse.json({ ok: true });
}
