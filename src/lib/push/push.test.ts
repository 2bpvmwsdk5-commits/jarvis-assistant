import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import https from "node:https";
import type http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { composeBriefing, isBriefingDue, localParts, weatherText } from "./briefing";
import { runScheduler, type SchedulerDeps } from "./scheduler";
import { isAllowedEndpoint, sendPush } from "./send";
import { memoryStore } from "./store";
import { deviceKey, saveDevice, validatePayload } from "./sync";
import type { DeviceRecord, PushMessage } from "./types";

const SUB = { endpoint: "https://web.push.apple.com/abc", keys: { p256dh: "p", auth: "a" } };

function payload(overrides: Record<string, unknown> = {}) {
  return validatePayload({
    deviceId: "geraet-1234",
    subscription: SUB,
    timeZone: "Europe/Berlin",
    userName: "Lena",
    jobs: [],
    briefing: { enabled: false, time: "07:30", city: "" },
    tasks: [],
    countdowns: [],
    ...overrides,
  })!;
}

function fakeDeps(result: "ok" | "gone" | "error" = "ok") {
  const sent: PushMessage[] = [];
  const deps: SchedulerDeps = {
    send: vi.fn(async (_s, m) => {
      sent.push(m);
      return result;
    }),
    geocode: vi.fn(async () => ({ lat: 52.5, lon: 13.4, label: "Berlin" })),
    weather: vi.fn(async () => "3 bis 8 °C, leicht bewölkt"),
  };
  return { deps, sent };
}

describe("Sicherheit", () => {
  it("erlaubt nur offizielle Push-Dienste", () => {
    expect(isAllowedEndpoint("https://web.push.apple.com/xyz")).toBe(true);
    expect(isAllowedEndpoint("https://fcm.googleapis.com/fcm/send/1")).toBe(true);
    expect(isAllowedEndpoint("https://evil.example.com/push")).toBe(false);
    expect(isAllowedEndpoint("http://web.push.apple.com/xyz")).toBe(false);
    expect(isAllowedEndpoint("https://push.apple.com.evil.com/x")).toBe(false);
    expect(isAllowedEndpoint("http://169.254.169.254/latest")).toBe(false);
  });

  it("lehnt ungültige Geräte und fremde Push-Adressen ab", () => {
    expect(validatePayload({ deviceId: "../x" })).toBeNull();
    expect(payload({ subscription: { endpoint: "https://evil.com", keys: { p256dh: "p", auth: "a" } } }).subscriptionInvalid).toBe(
      true,
    );
  });
});

describe("Taktgeber – Erinnerungen und Timer", () => {
  it("schickt fällige Aufträge genau einmal", async () => {
    const kv = memoryStore();
    const now = new Date("2026-11-18T14:00:30Z");
    await saveDevice(
      kv,
      payload({
        jobs: [
          { id: "r1", kind: "reminder", title: "Erinnerung", body: "Anruf bei Mama", at: "2026-11-18T14:00:00Z" },
          { id: "r2", kind: "reminder", title: "Erinnerung", body: "Später", at: "2026-11-18T15:00:00Z" },
          { id: "alt", kind: "timer", title: "Timer", body: "Uralt", at: "2026-11-17T01:00:00Z" },
        ],
      }),
    );
    const { deps, sent } = fakeDeps();
    expect((await runScheduler(kv, now, deps)).sent).toBe(1);
    expect(sent[0].body).toBe("Anruf bei Mama");
    // nächste Minute: nicht nochmal
    expect((await runScheduler(kv, new Date("2026-11-18T14:01:30Z"), deps)).sent).toBe(0);
    // um 15 Uhr: der zweite
    expect((await runScheduler(kv, new Date("2026-11-18T15:00:10Z"), deps)).sent).toBe(1);
  });

  it("entfernt abbestellte Abos", async () => {
    const kv = memoryStore();
    await saveDevice(kv, payload({ jobs: [{ id: "r1", kind: "reminder", title: "E", body: "x", at: "2026-11-18T14:00:00Z" }] }));
    const { deps } = fakeDeps("gone");
    const report = await runScheduler(kv, new Date("2026-11-18T14:00:30Z"), deps);
    expect(report.removedSubscriptions).toBe(1);
    expect((await kv.get<DeviceRecord>(deviceKey("geraet-1234")))?.subscription).toBeNull();
  });

  it("behält beim erneuten Melden die bereits gesendeten Aufträge", async () => {
    const kv = memoryStore();
    const job = { id: "r1", kind: "reminder", title: "E", body: "x", at: "2026-11-18T14:00:00Z" };
    await saveDevice(kv, payload({ jobs: [job] }));
    const { deps } = fakeDeps();
    await runScheduler(kv, new Date("2026-11-18T14:00:30Z"), deps);
    await saveDevice(kv, payload({ jobs: [job], subscription: undefined }));
    const device = await kv.get<DeviceRecord>(deviceKey("geraet-1234"));
    expect(device?.sentJobIds).toEqual(["r1"]);
    expect(device?.subscription?.endpoint).toBe(SUB.endpoint);
  });
});

describe("Morgenbericht", () => {
  it("rechnet in der Zeitzone des Geräts", () => {
    // 06:45 UTC = 07:45 in Berlin (Winterzeit)
    expect(localParts(new Date("2026-11-18T06:45:00Z"), "Europe/Berlin")).toEqual({ date: "2026-11-18", minutes: 465 });
  });

  it("ist zur Wunschzeit fällig – einmal pro Tag", async () => {
    const kv = memoryStore();
    await saveDevice(
      kv,
      payload({
        briefing: { enabled: true, time: "07:30", city: "Berlin" },
        tasks: [
          { title: "Anruf bei Mama", remindAt: "2026-11-18T14:30:00Z" },
          { title: "Einkaufen" },
        ],
        countdowns: [{ title: "Weihnachten", date: "2026-12-24" }],
      }),
    );
    const { deps, sent } = fakeDeps();
    expect((await runScheduler(kv, new Date("2026-11-18T06:20:00Z"), deps)).briefings).toBe(0); // 07:20 – zu früh
    expect((await runScheduler(kv, new Date("2026-11-18T06:31:00Z"), deps)).briefings).toBe(1); // 07:31
    expect((await runScheduler(kv, new Date("2026-11-18T06:40:00Z"), deps)).briefings).toBe(0); // schon gesendet
    expect((await runScheduler(kv, new Date("2026-11-19T06:31:00Z"), deps)).briefings).toBe(1); // nächster Tag
    expect(sent[0].title).toBe("Guten Morgen, Lena!");
    expect(sent[0].body).toContain("Berlin: 3 bis 8 °C, leicht bewölkt");
    expect(sent[0].body).toContain("Heute: 15:30 Anruf bei Mama");
    expect(sent[0].body).toContain("2 offene Aufgaben");
    expect(sent[0].body).toContain("Noch 36 Tage bis „Weihnachten“");
    expect(deps.geocode).toHaveBeenCalledTimes(1); // Ort wird gemerkt
  });

  it("schickt keinen verspäteten Bericht am Abend", async () => {
    const kv = memoryStore();
    await saveDevice(kv, payload({ briefing: { enabled: true, time: "07:30", city: "" } }));
    const device = (await kv.get<DeviceRecord>(deviceKey("geraet-1234")))!;
    expect(isBriefingDue(device, new Date("2026-11-18T19:00:00Z"))).toBe(false);
  });

  it("funktioniert auch ohne Wetter und Termine", () => {
    const device = { ...payload(), subscription: SUB, sentJobIds: [], briefingState: {}, createdAt: "", updatedAt: "" };
    const msg = composeBriefing(device as DeviceRecord, new Date("2026-11-18T06:31:00Z"), null);
    expect(msg.body).toContain("Mittwoch, 18. November.");
    expect(msg.body).toContain("ein freier Tag");
  });

  it("übersetzt Wettercodes", () => {
    expect(weatherText(0)).toBe("sonnig");
    expect(weatherText(63)).toBe("Regen");
    expect(weatherText(1234)).toBe("wechselhaft");
  });
});

describe("Echter Versand (verschlüsselt) an einen Probe-Push-Dienst", () => {
  let server: https.Server;
  const received: { headers: http.IncomingHttpHeaders; bytes: number }[] = [];

  beforeAll(async () => {
    vi.stubEnv("JARVIS_PUSH_ALLOW_LOCAL", "1");
    vi.stubEnv("NODE_TLS_REJECT_UNAUTHORIZED", "0"); // nur für das Test-Zertifikat
    // selbstsigniertes Test-Zertifikat erzeugen
    const dir = mkdtempSync(path.join(tmpdir(), "jarvis-push-"));
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "1",
      "-subj", "/CN=localhost", "-keyout", path.join(dir, "key.pem"), "-out", path.join(dir, "cert.pem"),
    ], { stdio: "ignore" });
    const tls = { key: readFileSync(path.join(dir, "key.pem")), cert: readFileSync(path.join(dir, "cert.pem")) };
    server = https.createServer(tls, (req, res) => {
      let bytes = 0;
      req.on("data", (c: Buffer) => (bytes += c.length));
      req.on("end", () => {
        received.push({ headers: req.headers, bytes });
        res.writeHead(req.url === "/gone" ? 410 : 201).end();
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
  });
  afterAll(() => {
    server.close();
    vi.unstubAllEnvs();
  });

  it("verschlüsselt, signiert und erkennt abbestellte Abos", async () => {
    const { port } = server.address() as AddressInfo;
    // gültiger Browser-Schlüssel (P-256) für die Verschlüsselung
    const { createECDH, randomBytes } = await import("node:crypto");
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const keys = { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
    const kv = memoryStore();

    const ok = await sendPush(kv, { endpoint: `https://localhost:${port}/ok`, keys }, { title: "T", body: "Hallo" });
    expect(ok).toBe("ok");
    expect(received[0].headers["content-encoding"]).toBe("aes128gcm");
    expect(String(received[0].headers.authorization)).toMatch(/^vapid t=.+, k=.+/);
    expect(received[0].bytes).toBeGreaterThan(50);

    const gone = await sendPush(kv, { endpoint: `https://localhost:${port}/gone`, keys }, { title: "T", body: "x" });
    expect(gone).toBe("gone");
  });
});
