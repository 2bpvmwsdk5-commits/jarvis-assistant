import { NextResponse } from "next/server";
import { isAccessCodeValid } from "@/lib/ai";
import { getKeyValueStore } from "@/lib/push/store";
import { deviceKey, saveDevice, validateDeviceId, validatePayload } from "@/lib/push/sync";

/**
 * POST   /api/push/sync → Gerät meldet Abo, Erinnerungen, Timer und Morgenbericht-Einstellungen
 * DELETE /api/push/sync → Gerät meldet sich ab
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAccessCodeValid(request.headers.get("x-jarvis-code"))) {
    return NextResponse.json({ error: "access_code" }, { status: 401 });
  }
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
