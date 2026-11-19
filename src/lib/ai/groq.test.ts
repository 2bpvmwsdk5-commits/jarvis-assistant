import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createGroqProvider, GROQ_BASE_URL, GROQ_DEFAULT_MODELS } from "./groq";

/** Probe-Server, der sich wie die Groq-API (OpenAI-kompatibel) verhält. */
const calls: { url: string; auth?: string; body: Record<string, unknown> }[] = [];
let mode = "ok";
let server: http.Server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      calls.push({ url: req.url ?? "", auth: req.headers.authorization, body });
      const json = (status: number, error: object) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify({ error }));
      };
      if (mode === "badkey") return json(401, { message: "Invalid API Key", code: "invalid_api_key" });
      if (mode === "ratelimit") return json(429, { message: "Rate limit reached", code: "rate_limit_exceeded" });
      if (mode === "first-model-gone" && body.model === GROQ_DEFAULT_MODELS[0]) {
        return json(404, { message: "The model does not exist", code: "model_not_found" });
      }
      if (mode === "no-tuning" && "reasoning_effort" in body) {
        return json(400, { message: "property 'reasoning_effort' is unsupported", code: "invalid_request_error" });
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      const chunk = (delta: object) => res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\n`);
      chunk({ role: "assistant", content: "" });
      chunk({ reasoning: "geheime Denkschritte" }); // darf nicht angezeigt werden
      chunk({ content: "Ein Regenbogen " });
      chunk({ content: "entsteht durch Lichtbrechung." });
      res.end("data: [DONE]\n\n");
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  vi.stubEnv("JARVIS_GROQ_BASE_URL", `http://localhost:${port}/openai/v1`);
  vi.stubEnv("GROQ_API_KEY", "gsk_geheimer_testschluessel");
});
afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
});
afterEach(() => {
  calls.length = 0;
  mode = "ok";
});

async function ask(text = "Wie entsteht ein Regenbogen?") {
  let out = "";
  for await (const piece of createGroqProvider().stream([{ role: "user", text }], { userName: "Lena" })) out += piece;
  return out;
}

describe("Groq-Anbindung", () => {
  it("verwendet die offizielle Adresse", () => {
    expect(GROQ_BASE_URL).toBe("https://api.groq.com/openai/v1");
  });

  it("streamt die Antwort und blendet Denkschritte aus", async () => {
    expect(await ask()).toBe("Ein Regenbogen entsteht durch Lichtbrechung.");
    expect(calls[0].url).toBe("/openai/v1/chat/completions");
    expect(calls[0].auth).toBe("Bearer gsk_geheimer_testschluessel");
    expect(calls[0].body.model).toBe("openai/gpt-oss-120b");
    expect(calls[0].body.stream).toBe(true);
    const messages = calls[0].body.messages as { role: string; content: string }[];
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("JARVIS");
    expect(messages[0].content).toContain("Lena");
  });

  it("weicht auf das zweite Modell aus, wenn das erste nicht verfügbar ist", async () => {
    mode = "first-model-gone";
    expect(await ask()).toContain("Regenbogen");
    expect(calls.map((c) => c.body.model)).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
  });

  it("wiederholt ohne Feineinstellungen, wenn Groq sie ablehnt", async () => {
    mode = "no-tuning";
    expect(await ask()).toContain("Regenbogen");
    expect(calls).toHaveLength(2);
    expect(calls[1].body).not.toHaveProperty("reasoning_effort");
  });

  it("erklärt einen ungültigen Schlüssel verständlich", async () => {
    mode = "badkey";
    expect(await ask()).toContain("GROQ_API_KEY bei Netlify");
  });

  it("erklärt ein ausgeschöpftes Kontingent", async () => {
    mode = "ratelimit";
    expect(await ask()).toContain("Kontingent");
  });

  it("nutzt GROQ_MODEL, wenn gesetzt", async () => {
    vi.stubEnv("GROQ_MODEL", "mein/modell");
    await ask();
    expect(calls[0].body.model).toBe("mein/modell");
    vi.stubEnv("GROQ_MODEL", "");
  });
});
