import { NextResponse } from "next/server";
import { sendPush } from "@/lib/push/send";
import { getKeyValueStore } from "@/lib/push/store";
import { deviceKey, validateDeviceId } from "@/lib/push/sync";
import type { DeviceRecord } from "@/lib/push/types";

/** POST /api/push/test → schickt sofort eine Test-Benachrichtigung an dieses Gerät */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { deviceId?: unknown } | null;
  const id = validateDeviceId(body?.deviceId);
  if (!id) return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });

  const kv = getKeyValueStore();
  const device = await kv.get<DeviceRecord>(deviceKey(id));
  if (!device?.subscription) return NextResponse.json({ error: "not_subscribed" }, { status: 404 });

  const result = await sendPush(kv, device.subscription, {
    title: "JARVIS",
    body: `${device.userName ? `${device.userName}, ` : ""}Benachrichtigungen funktionieren. Ich melde mich, wenn es etwas gibt.`,
    tag: "test",
    url: "/",
  });
  if (result === "gone") {
    await kv.set(deviceKey(id), { ...device, subscription: null });
  }
  return NextResponse.json({ result }, { status: result === "ok" ? 200 : 502 });
}
