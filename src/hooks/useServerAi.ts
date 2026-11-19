"use client";

import { useEffect, useState } from "react";
import type { ChatApiStatus } from "@/lib/types";

/**
 * Fragt einmal beim Start, welches KI-Gehirn auf dem Server aktiv ist (z. B. „groq“).
 * Der Server verrät dabei nur den Namen – niemals einen Schlüssel.
 */
export function useServerAi() {
  const [status, setStatus] = useState<ChatApiStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d: ChatApiStatus) => !cancelled && setStatus(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const hasCloudAi = status?.provider === "groq" || status?.provider === "claude";
  return { status, loaded: status !== null, hasCloudAi };
}
