"use client";

import { useMemo, useState, type FormEvent } from "react";
import { daysUntil, formatClock } from "@/lib/chrono";
import { useNow } from "@/hooks/useNow";
import type { Countdown, Timer } from "@/lib/types";
import { CalendarIcon, PauseIcon, PlayIcon, PlusIcon, TimerIcon, TrashIcon } from "./Icons";

interface TimersPanelProps {
  timers: Timer[];
  countdowns: Countdown[];
  onStartTimer: (durationMs: number, label: string) => void;
  onPauseTimer: (id: string) => void;
  onResumeTimer: (id: string) => void;
  onDeleteTimer: (id: string) => void;
  onAddCountdown: (title: string, date: Date) => void;
  onDeleteCountdown: (id: string) => void;
}

const QUICK_MINUTES = [1, 3, 5, 10, 15, 30];

export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function remainingMs(timer: Timer, now: number): number {
  if (timer.endAt) return Math.max(0, Date.parse(timer.endAt) - now);
  return timer.remainingMs ?? timer.durationMs;
}

export function TimersPanel(props: TimersPanelProps) {
  const [tab, setTab] = useState<"timer" | "countdown">("timer");

  return (
    <section className="panel chrono" aria-label="Timer und Countdowns">
      <header className="panel__header">
        <h2 className="panel__title">
          <span className="panel__dot" /> Zeit
        </h2>
        <div className="segmented" role="tablist" aria-label="Bereich">
          <button role="tab" aria-selected={tab === "timer"} onClick={() => setTab("timer")}>
            Timer <b>{props.timers.length}</b>
          </button>
          <button role="tab" aria-selected={tab === "countdown"} onClick={() => setTab("countdown")}>
            Countdowns <b>{props.countdowns.length}</b>
          </button>
        </div>
      </header>
      {tab === "timer" ? <TimerSection {...props} /> : <CountdownSection {...props} />}
    </section>
  );
}

/* ───────────── Timer ───────────── */

function TimerSection({ timers, onStartTimer, onPauseTimer, onResumeTimer, onDeleteTimer }: TimersPanelProps) {
  const [minutes, setMinutes] = useState("");
  const [label, setLabel] = useState("");
  const now = useNow()?.getTime() ?? 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = Number(minutes.replace(",", "."));
    if (!m || m <= 0) return;
    onStartTimer(Math.min(m, 24 * 60) * 60_000, label.trim() || "Timer");
    setMinutes("");
    setLabel("");
  };

  return (
    <div className="chrono__body">
      <div className="quick" role="group" aria-label="Schnellstart">
        {QUICK_MINUTES.map((m) => (
          <button key={m} className="quick__btn" onClick={() => onStartTimer(m * 60_000, "Timer")}>
            <b>{m}</b> Min
          </button>
        ))}
      </div>

      <form className="chrono__form" onSubmit={submit}>
        <input
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 40))}
          placeholder="Bezeichnung (optional)"
          aria-label="Bezeichnung des Timers"
        />
        <input
          className="input chrono__minutes"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
          placeholder="Minuten, z. B. 8"
          inputMode="decimal"
          aria-label="Minuten"
        />
        <button type="submit" className="btn btn--primary" disabled={!Number(minutes.replace(",", "."))} aria-label="Timer starten">
          <PlayIcon size={16} /> <span className="btn__label">Start</span>
        </button>
      </form>

      <ul className="chrono__list">
        {timers.length === 0 && (
          <li className="tasks__empty">
            Kein Timer aktiv. Tippen Sie auf eine Zeit oder sagen Sie: „Timer auf 5 Minuten“.
          </li>
        )}
        {timers.map((t) => {
          const left = remainingMs(t, now);
          const progress = t.durationMs ? 1 - left / t.durationMs : 0;
          const paused = !t.endAt;
          return (
            <li key={t.id} className={`timer ${paused ? "is-paused" : ""}`}>
              <ProgressRing progress={progress} />
              <div className="timer__body">
                <span className="timer__time" suppressHydrationWarning>
                  {formatClock(left)}
                </span>
                <span className="timer__label">
                  {t.label}
                  {paused && " · pausiert"}
                </span>
              </div>
              <button
                className="icon-btn icon-btn--small"
                onClick={() => (paused ? onResumeTimer(t.id) : onPauseTimer(t.id))}
                aria-label={paused ? `${t.label} fortsetzen` : `${t.label} pausieren`}
              >
                {paused ? <PlayIcon size={15} /> : <PauseIcon size={15} />}
              </button>
              <button className="icon-btn icon-btn--small" onClick={() => onDeleteTimer(t.id)} aria-label={`${t.label} beenden`}>
                <TrashIcon size={15} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProgressRing({ progress }: { progress: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r={r} className="ring__track" />
      <circle
        cx="24"
        cy="24"
        r={r}
        className="ring__bar"
        strokeDasharray={c}
        strokeDashoffset={c * Math.min(1, Math.max(0, progress))}
      />
      <foreignObject x="12" y="12" width="24" height="24">
        <TimerIcon size={24} />
      </foreignObject>
    </svg>
  );
}

/* ───────────── Countdowns ───────────── */

function CountdownSection({ countdowns, onAddCountdown, onDeleteCountdown }: TimersPanelProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const now = useNow() ?? new Date(0);

  const sorted = useMemo(() => [...countdowns].sort((a, b) => a.date.localeCompare(b.date)), [countdowns]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onAddCountdown(title.trim(), parseLocalDate(date));
    setTitle("");
    setDate("");
  };

  return (
    <div className="chrono__body">
      <form className="chrono__form chrono__form--countdown" onSubmit={submit}>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 60))}
          placeholder="Wofür? z. B. Urlaub"
          aria-label="Name des Countdowns"
        />
        <label className="input input--with-icon">
          <CalendarIcon size={16} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Datum" />
        </label>
        <button type="submit" className="btn btn--primary" disabled={!title.trim() || !date} aria-label="Countdown hinzufügen">
          <PlusIcon size={16} /> <span className="btn__label">Hinzufügen</span>
        </button>
      </form>

      <ul className="chrono__list">
        {sorted.length === 0 && (
          <li className="tasks__empty">Noch keine Countdowns. Zum Beispiel: „Countdown: Urlaub am 1. Juli“.</li>
        )}
        {sorted.map((c) => {
          const d = parseLocalDate(c.date);
          const days = daysUntil(d, now);
          return (
            <li key={c.id} className={`countdown ${days < 0 ? "is-past" : days === 0 ? "is-today" : ""}`}>
              <div className="countdown__days">
                {days === 0 ? (
                  <b>Heute</b>
                ) : (
                  <>
                    <b>{Math.abs(days)}</b>
                    <span>{days < 0 ? "vorbei" : Math.abs(days) === 1 ? "Tag" : "Tage"}</span>
                  </>
                )}
              </div>
              <div className="timer__body">
                <span className="countdown__title">{c.title}</span>
                <span className="timer__label">
                  {d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <button className="icon-btn icon-btn--small" onClick={() => onDeleteCountdown(c.id)} aria-label={`Countdown ${c.title} löschen`}>
                <TrashIcon size={15} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Laufende Timer als kleine Leuchtanzeige unter dem KI-Kern. */
export function TimerPills({ timers }: { timers: Timer[] }) {
  const now = useNow()?.getTime() ?? 0;
  if (!timers.length) return null;
  return (
    <div className="timer-pills" aria-label="Laufende Timer">
      {timers.slice(0, 3).map((t) => (
        <span key={t.id} className={`timer-pill ${t.endAt ? "" : "is-paused"}`} suppressHydrationWarning>
          <TimerIcon size={14} />
          {t.label !== "Timer" && <em>{t.label}</em>}
          {formatClock(remainingMs(t, now))}
        </span>
      ))}
    </div>
  );
}
