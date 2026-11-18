import { afterEach, describe, expect, it, vi } from "vitest";
import { getProvider, isAccessCodeValid } from "./index";

afterEach(() => vi.unstubAllEnvs());

describe("Auswahl des KI-Gehirns", () => {
  it("nutzt standardmäßig das lokale Gehirn", () => {
    vi.stubEnv("JARVIS_AI_PROVIDER", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getProvider().name).toBe("local");
  });

  it("nutzt Claude nicht ohne API-Schlüssel", () => {
    vi.stubEnv("JARVIS_AI_PROVIDER", "claude");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("JARVIS_ACCESS_CODE", "geheim");
    expect(getProvider().name).toBe("local");
  });

  it("nutzt Claude nicht ohne Zugangscode (Kostenschutz)", () => {
    vi.stubEnv("JARVIS_AI_PROVIDER", "claude");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("JARVIS_ACCESS_CODE", "");
    expect(getProvider().name).toBe("local");
  });

  it("nutzt Gemini, sobald ein Gemini-Schlüssel gesetzt ist (ohne weitere Einstellungen)", () => {
    vi.stubEnv("JARVIS_AI_PROVIDER", "");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    expect(getProvider().name).toBe("gemini");
  });

  it("„local“ erzwingt das lokale Gehirn trotz Gemini-Schlüssel", () => {
    vi.stubEnv("JARVIS_AI_PROVIDER", "local");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    expect(getProvider().name).toBe("local");
  });

  it("nutzt Claude, wenn alles eingerichtet ist", () => {
    vi.stubEnv("JARVIS_AI_PROVIDER", "claude");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("JARVIS_ACCESS_CODE", "geheim");
    expect(getProvider().name).toBe("claude");
  });
});

describe("Zugangscode", () => {
  it("ist ohne festgelegten Code frei", () => {
    vi.stubEnv("JARVIS_ACCESS_CODE", "");
    expect(isAccessCodeValid(null)).toBe(true);
  });

  it("prüft den Code genau", () => {
    vi.stubEnv("JARVIS_ACCESS_CODE", "Lila-Kern-42");
    expect(isAccessCodeValid("Lila-Kern-42")).toBe(true);
    expect(isAccessCodeValid(" Lila-Kern-42 ")).toBe(true);
    expect(isAccessCodeValid("lila-kern-42")).toBe(false);
    expect(isAccessCodeValid("")).toBe(false);
    expect(isAccessCodeValid(null)).toBe(false);
  });
});

describe("Eigener Gemini-Schlüssel", () => {
  it("akzeptiert verschiedene Schlüsselformate", async () => {
    const { looksLikeGeminiKey } = await import("./gemini");
    expect(looksLikeGeminiKey("AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvW")).toBe(true);
    expect(looksLikeGeminiKey("AQ.Ab8RN6Lx_neues-Format.mit.Punkten")).toBe(true);
    expect(looksLikeGeminiKey("kurz")).toBe(false);
    expect(looksLikeGeminiKey("mit Leerzeichen innen drin 12345")).toBe(false);
    expect(looksLikeGeminiKey("Umlaut-ä-geht-nicht-1234567890")).toBe(false);
  });
});
