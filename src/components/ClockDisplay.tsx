"use client";

import { useNow } from "@/hooks/useNow";

/** Live-Uhrzeit und Datum im holografischen Stil. */
export function ClockDisplay() {
  const now = useNow();

  const time = now ? now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const seconds = now ? String(now.getSeconds()).padStart(2, "0") : "--";
  const date = now
    ? now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : " ";

  return (
    <div className="clock" aria-live="off">
      <div className="clock__time">
        <time suppressHydrationWarning>{time}</time>
        <span className="clock__seconds">{seconds}</span>
      </div>
      <div className="clock__date">{date}</div>
    </div>
  );
}
