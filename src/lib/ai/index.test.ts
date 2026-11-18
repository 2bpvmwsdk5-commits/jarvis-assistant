import { afterEach, describe, expect, it, vi } from "vitest";
import { getProvider, isAccessCodeValid } from "./index";

afterEach(() => vi.unstubAllEnvs());

describe("Auswahl des KI-Gehirns", () => {
  it("nutzt standardmäßig das lokale Gehirn", () => {
    vi.stubEnv("JARVIS_AI_PROVIDER", "");
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
