"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeWhen, formatDate, formatTime, greetingFor, parseCommand, type Command } from "@/lib/commands";
import {
  DEFAULT_SETTINGS,
  type ChatMessage,
  type CoreState,
  type Countdown,
  type Settings,
  type Task,
  type Timer,
} from "@/lib/types";
import { describeCountdown, formatDuration } from "@/lib/chrono";
import { playChime, unlockAudio } from "@/lib/sound";
import { useIsClient, usePersistentState } from "@/hooks/usePersistentState";
import { useSpeechRecognition, useSpeechSynthesis } from "@/hooks/useSpeech";
import { useInstall } from "@/hooks/useInstall";
import { localAnswer } from "@/lib/ai/local";
import { AICore, STATE_LABEL } from "./AICore";
import { BootScreen } from "./BootScreen";
import { ChatPanel } from "./ChatPanel";
import { ClockDisplay } from "./ClockDisplay";
import { HoloBackground } from "./HoloBackground";
import { BellIcon, ChatIcon, CloseIcon, ListIcon, MicIcon, MuteIcon, SettingsIcon, TimerIcon, VolumeIcon } from "./Icons";
import { SettingsPanel } from "./SettingsPanel";
import { TasksPanel } from "./TasksPanel";
import { parseLocalDate, remainingMs, TimerPills, TimersPanel } from "./TimersPanel";

const MAX_STORED_MESSAGES = 100;
const SUGGESTIONS = [
  "Was kannst du?",
  "Wie spät ist es?",
  "Timer auf 5 Minuten",
  "Wie viele Tage bis Weihnachten?",
  "Erinnere mich in 5 Minuten an den Tee",
  "Erzähl mir einen Witz",
];

interface Toast {
  id: string;
  title: string;
  text: string;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function JarvisApp() {
  const isClient = useIsClient();
  const [settings, setSettings] = usePersistentState<Settings>("jarvis.settings", DEFAULT_SETTINGS);
  const [tasks, setTasks] = usePersistentState<Task[]>("jarvis.tasks", []);
  const [messages, setMessages] = usePersistentState<ChatMessage[]>("jarvis.chat", []);
  const [timers, setTimers] = usePersistentState<Timer[]>("jarvis.timers", []);
  const [countdowns, setCountdowns] = usePersistentState<Countdown[]>("jarvis.countdowns", []);

  const [booted, setBooted] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "tasks" | "timers">("chat");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const tts = useSpeechSynthesis();
  const installer = useInstall();
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* ───────────── Hilfsfunktionen ───────────── */

  const say = useCallback(
    (text: string) => {
      if (settings.voiceEnabled) {
        tts.speak(text, { voiceName: settings.voiceName, rate: settings.speechRate, pitch: settings.speechPitch });
      }
    },
    [settings.voiceEnabled, settings.voiceName, settings.speechRate, settings.speechPitch, tts],
  );

  const addMessage = useCallback(
    (role: ChatMessage["role"], text: string) => {
      const msg: ChatMessage = { id: uid(), role, text, createdAt: new Date().toISOString() };
      setMessages((prev) => [...prev, msg].slice(-MAX_STORED_MESSAGES));
      return msg;
    },
    [setMessages],
  );

  const updateMessage = useCallback(
    (id: string, text: string) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text } : m))),
    [setMessages],
  );

  const jarvisSays = useCallback(
    (text: string) => {
      addMessage("jarvis", text);
      say(text);
    },
    [addMessage, say],
  );

  const pushToast = useCallback((title: string, text: string) => {
    const id = uid();
    setToasts((prev) => [...prev, { id, title, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 9000);
  }, []);

  /* ───────────── Aufgaben ───────────── */

  const addTask = useCallback(
    (title: string, remindAt?: Date) => {
      const task: Task = {
        id: uid(),
        title,
        done: false,
        createdAt: new Date().toISOString(),
        remindAt: remindAt?.toISOString(),
      };
      setTasks((prev) => [...prev, task]);
      // Erlaubnis für System-Benachrichtigungen erfragen (nur einmal)
      if (remindAt && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      return task;
    },
    [setTasks],
  );

  const toggleTask = useCallback(
    (id: string) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    [setTasks],
  );
  const deleteTask = useCallback((id: string) => setTasks((prev) => prev.filter((t) => t.id !== id)), [setTasks]);
  const clearDone = useCallback(() => setTasks((prev) => prev.filter((t) => !t.done)), [setTasks]);

  // Erinnerungen prüfen (alle 10 Sekunden)
  useEffect(() => {
    if (!booted) return;
    const check = () => {
      const now = Date.now();
      const due = tasks.filter((t) => t.remindAt && !t.done && !t.notified && Date.parse(t.remindAt) <= now);
      if (!due.length) return;
      setTasks((prev) => prev.map((t) => (due.some((d) => d.id === t.id) ? { ...t, notified: true } : t)));
      for (const t of due) {
        const text = `Erinnerung: ${t.title}`;
        pushToast("Erinnerung", t.title);
        jarvisSays(`${settings.userName ? `${settings.userName}, ` : ""}${text}.`);
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
          const options = { body: t.title, icon: "/icon-192.png", badge: "/icon-192.png", tag: t.id };
          const fallback = () => {
            try {
              new Notification("JARVIS – Erinnerung", options);
            } catch {
              /* manche mobilen Browser erlauben das nur als installierte App */
            }
          };
          if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((r) => r.showNotification("JARVIS – Erinnerung", options)).catch(fallback);
          } else {
            fallback();
          }
        }
      }
    };
    check();
    const timer = setInterval(check, 10_000);
    return () => clearInterval(timer);
  }, [booted, tasks, setTasks, pushToast, jarvisSays, settings.userName]);

  /* ───────────── Timer & Countdowns ───────────── */

  const startTimer = useCallback(
    (durationMs: number, label: string) => {
      unlockAudio(); // Tippen/Sprechen ist eine Berührung → Ton ist danach erlaubt
      const timer: Timer = { id: uid(), label, durationMs, endAt: new Date(Date.now() + durationMs).toISOString() };
      setTimers((prev) => [...prev, timer]);
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    },
    [setTimers],
  );
  const pauseTimer = useCallback(
    (id: string) =>
      setTimers((prev) =>
        prev.map((t) => (t.id === id && t.endAt ? { ...t, endAt: undefined, remainingMs: remainingMs(t, Date.now()) } : t)),
      ),
    [setTimers],
  );
  const resumeTimer = useCallback(
    (id: string) =>
      setTimers((prev) =>
        prev.map((t) =>
          t.id === id && !t.endAt
            ? { ...t, endAt: new Date(Date.now() + (t.remainingMs ?? t.durationMs)).toISOString(), remainingMs: undefined }
            : t,
        ),
      ),
    [setTimers],
  );
  const deleteTimer = useCallback((id: string) => setTimers((prev) => prev.filter((t) => t.id !== id)), [setTimers]);

  const addCountdown = useCallback(
    (title: string, date: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      setCountdowns((prev) => [...prev, { id: uid(), title, date: ymd, createdAt: new Date().toISOString() }]);
    },
    [setCountdowns],
  );
  const deleteCountdown = useCallback(
    (id: string) => setCountdowns((prev) => prev.filter((c) => c.id !== id)),
    [setCountdowns],
  );

  // Abgelaufene Timer erkennen (jede halbe Sekunde)
  useEffect(() => {
    if (!booted) return;
    const check = () => {
      const now = Date.now();
      const done = timers.filter((t) => t.endAt && Date.parse(t.endAt) <= now);
      if (!done.length) return;
      setTimers((prev) => prev.filter((t) => !done.some((d) => d.id === t.id)));
      playChime();
      if ("vibrate" in navigator) navigator.vibrate?.([300, 150, 300, 150, 300]);
      for (const t of done) {
        const lateMin = Math.floor((now - Date.parse(t.endAt!)) / 60_000);
        const name = t.label === "Timer" ? "Ihr Timer" : `Der Timer für ${t.label}`;
        const text =
          lateMin >= 1
            ? `${name} ist vor ${lateMin} ${lateMin === 1 ? "Minute" : "Minuten"} abgelaufen.`
            : `${settings.userName ? `${settings.userName}, ` : ""}${name.charAt(0).toLowerCase() + name.slice(1)} ist abgelaufen.`;
        pushToast("Timer abgelaufen", t.label === "Timer" ? formatDuration(t.durationMs) : t.label);
        // kurz warten, damit der Signalton zuerst erklingt
        setTimeout(() => jarvisSays(text.charAt(0).toUpperCase() + text.slice(1)), 1200);
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
          const options = { body: t.label, icon: "/icon-192.png", badge: "/icon-192.png", tag: t.id };
          navigator.serviceWorker?.ready
            .then((r) => r.showNotification("JARVIS – Timer abgelaufen", options))
            .catch(() => {});
        }
      }
    };
    check();
    const interval = setInterval(check, 500);
    return () => clearInterval(interval);
  }, [booted, timers, setTimers, pushToast, jarvisSays, settings.userName]);

  /* ───────────── Befehle & Chat ───────────── */

  const runCommand = useCallback(
    (cmd: Command): string => {
      const now = new Date();
      switch (cmd.kind) {
        case "addTask": {
          addTask(cmd.title, cmd.remindAt);
          return cmd.remindAt
            ? `Erledigt. Ich erinnere Sie ${describeWhen(cmd.remindAt, now)} an: ${cmd.title}.`
            : `Notiert. „${cmd.title}“ steht jetzt auf Ihrer Aufgabenliste.`;
        }
        case "listTasks": {
          const open = tasks.filter((t) => !t.done);
          if (!open.length) return "Sie haben aktuell keine offenen Aufgaben.";
          const names = open.slice(0, 5).map((t) => t.title);
          const more = open.length > 5 ? ` und ${open.length - 5} weitere` : "";
          return `Sie haben ${open.length} offene ${open.length === 1 ? "Aufgabe" : "Aufgaben"}: ${names.join(", ")}${more}.`;
        }
        case "time":
          return `Es ist ${formatTime(now)} Uhr.`;
        case "date":
          return `Heute ist ${formatDate(now)}.`;
        case "help":
          return "Ich kann mit Ihnen sprechen, Aufgaben notieren, Sie erinnern, Timer stellen und Tage zählen. Sagen Sie zum Beispiel: „Neue Aufgabe: Wäsche waschen“, „Erinnere mich um 15 Uhr an den Anruf“, „Timer auf 10 Minuten“, „Wie viele Tage bis Weihnachten?“ oder „Countdown: Urlaub am 1. Juli“.";
        case "startTimer": {
          startTimer(cmd.durationMs, cmd.label);
          const what = cmd.label === "Timer" ? "" : ` für ${cmd.label}`;
          return `Timer${what} gestellt: ${formatDuration(cmd.durationMs)}. Ich sage Bescheid, wenn die Zeit um ist.`;
        }
        case "cancelTimer": {
          if (!timers.length) return "Es läuft gerade kein Timer.";
          setTimers([]);
          return timers.length === 1 ? "Der Timer wurde gestoppt." : `Alle ${timers.length} Timer wurden gestoppt.`;
        }
        case "timerStatus": {
          if (!timers.length) return "Es läuft gerade kein Timer.";
          return timers
            .map((t) => {
              const name = t.label === "Timer" ? "Der Timer" : `Der Timer für ${t.label}`;
              const left = formatDuration(remainingMs(t, now.getTime()));
              return t.endAt ? `${name} läuft noch ${left}.` : `${name} ist pausiert, ${left} übrig.`;
            })
            .join(" ");
        }
        case "countdownQuery": {
          if (cmd.date) return describeCountdown(cmd.label, cmd.date, now);
          const q = cmd.label.toLowerCase();
          const saved = countdowns.find((c) => {
            const t = c.title.toLowerCase();
            return t.includes(q) || q.includes(t);
          });
          if (saved) return describeCountdown(`„${saved.title}“`, parseLocalDate(saved.date), now);
          return "Dieses Datum kenne ich leider nicht. Fragen Sie zum Beispiel: „Wie viele Tage bis zum 24.12.?“ – oder legen Sie einen Countdown an: „Countdown: Urlaub am 1. Juli“.";
        }
        case "addCountdown": {
          addCountdown(cmd.title, cmd.date);
          return `Countdown „${cmd.title}“ angelegt. ${describeCountdown(`„${cmd.title}“`, cmd.date, now)}`;
        }
        case "listCountdowns": {
          if (!countdowns.length) return "Sie haben noch keine Countdowns. Sagen Sie zum Beispiel: „Countdown: Urlaub am 1. Juli“.";
          return [...countdowns]
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 5)
            .map((c) => describeCountdown(`„${c.title}“`, parseLocalDate(c.date), now))
            .join(" ");
        }
      }
    },
    [addTask, tasks, startTimer, timers, setTimers, countdowns, addCountdown],
  );

  const handleUserInput = useCallback(
    async (text: string) => {
      tts.cancel();
      addMessage("user", text);

      const cmd = parseCommand(text);
      if (cmd) {
        jarvisSays(runCommand(cmd));
        return;
      }

      setThinking(true);
      let replyId: string | null = null;
      let unreachable = false; // Anfrage kam gar nicht beim Server an (z. B. kein Internet)
      try {
        const history = [...messagesRef.current, { role: "user" as const, text }]
          .slice(-20)
          .map((m) => ({ role: m.role === "jarvis" ? ("assistant" as const) : ("user" as const), text: m.text }));
        const now = new Date();
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-jarvis-code": settings.accessCode },
          body: JSON.stringify({
            messages: history,
            userName: settings.userName,
            localTime: `${formatDate(now)}, ${formatTime(now)} Uhr`,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            tasks: tasks
              .filter((t) => !t.done)
              .slice(0, 30)
              .map((t) => ({ title: t.title, remindAt: t.remindAt ? describeWhen(new Date(t.remindAt), now) : undefined })),
          }),
        }).catch((error: unknown) => {
          unreachable = true;
          throw error;
        });

        if (res.status === 401) {
          jarvisSays(
            settings.accessCode
              ? "Der Zugangscode stimmt leider nicht. Bitte prüfen Sie ihn in den Einstellungen."
              : "Für mein KI-Modul brauche ich einen Zugangscode. Bitte tragen Sie ihn in den Einstellungen ein.",
          );
          return;
        }
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        // Antwort Stück für Stück lesen und sofort anzeigen
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let reply = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          reply += decoder.decode(value, { stream: true });
          if (!reply.trim()) continue;
          if (!replyId) {
            setThinking(false);
            replyId = addMessage("jarvis", reply).id;
          } else {
            updateMessage(replyId, reply);
          }
        }
        reply = (reply + decoder.decode()).trim();
        if (!reply) throw new Error("Leere Antwort");
        if (replyId) updateMessage(replyId, reply);
        else addMessage("jarvis", reply);
        say(reply);
      } catch {
        // Ohne Internet antwortet das eingebaute Gehirn direkt auf dem Gerät
        const msg =
          unreachable && !replyId
            ? localAnswer(text, settings.userName)
          : "Verbindung zum Kernsystem unterbrochen. Bitte versuchen Sie es gleich noch einmal.";
        if (replyId) updateMessage(replyId, msg);
        else addMessage("jarvis", msg);
        say(msg);
      } finally {
        setThinking(false);
      }
    },
    [addMessage, updateMessage, jarvisSays, say, runCommand, settings.userName, settings.accessCode, tasks, tts],
  );

  const stt = useSpeechRecognition(handleUserInput);
  const toggleMic = useCallback(() => {
    if (stt.listening) {
      stt.stop();
    } else {
      tts.cancel();
      stt.start();
    }
  }, [stt, tts]);

  /* ───────────── Start & Begrüßung ───────────── */

  const start = useCallback(
    (name: string) => {
      unlockAudio();
      if (name && name !== settings.userName) setSettings((s) => ({ ...s, userName: name }));
      setBooted(true);
      const now = new Date();
      const open = tasks.filter((t) => !t.done);
      const next = open
        .filter((t) => t.remindAt && Date.parse(t.remindAt) > now.getTime())
        .sort((a, b) => Date.parse(a.remindAt!) - Date.parse(b.remindAt!))[0];

      const parts = [
        greetingFor(now, name || settings.userName),
        "Alle Systeme sind online.",
        open.length
          ? `Sie haben ${open.length} offene ${open.length === 1 ? "Aufgabe" : "Aufgaben"}.`
          : "Ihre Aufgabenliste ist leer.",
        next ? `Nächste Erinnerung ${describeWhen(new Date(next.remindAt!), now)}: ${next.title}.` : "",
        "Wie kann ich Ihnen helfen?",
      ].filter(Boolean);
      const greeting = parts.join(" ");

      // kleine Verzögerung, damit die Start-Animation sichtbar ist
      setTimeout(() => {
        addMessage("jarvis", greeting);
        if (settings.greetingEnabled) say(greeting);
      }, 700);
    },
    [addMessage, say, setSettings, settings.greetingEnabled, settings.userName, tasks],
  );

  /* ───────────── Darstellung ───────────── */

  const coreState: CoreState = stt.listening
    ? "listening"
    : tts.speaking
      ? "speaking"
      : thinking
        ? "thinking"
        : "idle";

  const openTasks = tasks.filter((t) => !t.done);
  const upcoming = openTasks.filter((t) => t.remindAt && !t.notified).length;
  const lastJarvis = [...messages].reverse().find((m) => m.role === "jarvis");

  if (!isClient) {
    // Beim ersten Laden: nur der Hintergrund (verhindert Flackern)
    return (
      <div className="app">
        <HoloBackground />
      </div>
    );
  }

  return (
    <div className="app" data-booted={booted}>
      <HoloBackground />

      {!booted && <BootScreen userName={settings.userName} onStart={start} />}

      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <div>
            <div className="brand__name">J.A.R.V.I.S.</div>
            <div className="brand__tag">Persönlicher Assistent</div>
          </div>
        </div>
        <ClockDisplay />
        <div className="topbar__actions">
          <button
            className="icon-btn"
            onClick={() => {
              if (settings.voiceEnabled) tts.cancel();
              setSettings((s) => ({ ...s, voiceEnabled: !s.voiceEnabled }));
            }}
            aria-label={settings.voiceEnabled ? "Sprachausgabe ausschalten" : "Sprachausgabe einschalten"}
            title={settings.voiceEnabled ? "Sprachausgabe an" : "Sprachausgabe aus"}
          >
            {settings.voiceEnabled ? <VolumeIcon /> : <MuteIcon />}
          </button>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen öffnen" title="Einstellungen">
            <SettingsIcon />
          </button>
        </div>
      </header>

      <main className="layout" data-tab={mobileTab}>
        <section className="stage" aria-label="KI-Kern">
          <div className="stage__hud stage__hud--left">
            <span className="hud-label">Aufgaben</span>
            <span className="hud-value">{openTasks.length}</span>
            <span className="hud-label">offen</span>
          </div>
          <div className="stage__hud stage__hud--right">
            <span className="hud-label">Erinnerungen</span>
            <span className="hud-value">{upcoming}</span>
            <span className="hud-label">geplant</span>
          </div>

          <button
            className="stage__core-btn"
            onClick={stt.supported ? toggleMic : undefined}
            aria-label={stt.supported ? (stt.listening ? "Zuhören beenden" : "Sprechen") : "KI-Kern"}
            tabIndex={stt.supported ? 0 : -1}
          >
            <AICore state={coreState} />
          </button>

          <div className="stage__status" aria-live="polite">
            <span className="status-pill" data-state={coreState}>
              <i /> {STATE_LABEL[coreState]}
            </span>
            <p className="stage__caption">
              {stt.listening
                ? stt.interim || "Sprechen Sie jetzt …"
                : (lastJarvis?.text ?? "Bereit für Ihre Befehle.")}
            </p>
            <TimerPills timers={timers} />
            {stt.error && <p className="stage__error">{stt.error}</p>}
          </div>

          <div className="stage__controls">
            {stt.supported && (
              <button className={`mic-orb ${stt.listening ? "is-active" : ""}`} onClick={toggleMic} aria-pressed={stt.listening}>
                <MicIcon size={22} />
                <span>{stt.listening ? "Stopp" : "Sprechen"}</span>
              </button>
            )}
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => handleUserInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="layout__chat">
          <ChatPanel
            messages={messages}
            thinking={thinking}
            listening={stt.listening}
            interim={stt.interim}
            micSupported={stt.supported}
            onSend={handleUserInput}
            onMic={toggleMic}
            onClear={() => setMessages([])}
          />
        </div>

        <div className="layout__tasks">
          <TasksPanel tasks={tasks} onAdd={addTask} onToggle={toggleTask} onDelete={deleteTask} onClearDone={clearDone} />
        </div>

        <div className="layout__timers">
          <TimersPanel
            timers={timers}
            countdowns={countdowns}
            onStartTimer={startTimer}
            onPauseTimer={pauseTimer}
            onResumeTimer={resumeTimer}
            onDeleteTimer={deleteTimer}
            onAddCountdown={addCountdown}
            onDeleteCountdown={deleteCountdown}
          />
        </div>
      </main>

      <nav className="tabbar" aria-label="Bereiche">
        <button aria-current={mobileTab === "chat"} onClick={() => setMobileTab("chat")}>
          <ChatIcon /> Chat
        </button>
        <button aria-current={mobileTab === "tasks"} onClick={() => setMobileTab("tasks")}>
          <ListIcon /> Aufgaben {openTasks.length > 0 && <b className="badge">{openTasks.length}</b>}
        </button>
        <button aria-current={mobileTab === "timers"} onClick={() => setMobileTab("timers")}>
          <TimerIcon /> Zeit {timers.length > 0 && <b className="badge">{timers.length}</b>}
        </button>
      </nav>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        voices={tts.voices}
        speechSupported={tts.supported}
        installer={installer}
        onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        onTestVoice={() =>
          tts.speak(`Hallo${settings.userName ? ` ${settings.userName}` : ""}, so klinge ich mit diesen Einstellungen.`, {
            voiceName: settings.voiceName,
            rate: settings.speechRate,
            pitch: settings.speechPitch,
          })
        }
        onClearChat={() => setMessages([])}
        onResetAll={() => {
          tts.cancel();
          setMessages([]);
          setTasks([]);
          setTimers([]);
          setCountdowns([]);
          setSettings(DEFAULT_SETTINGS);
          setSettingsOpen(false);
          setBooted(false);
        }}
        onClose={() => setSettingsOpen(false)}
      />

      <div className="toasts" aria-live="assertive">
        {toasts.map((t) => (
          <div key={t.id} className="toast" role="alert">
            <BellIcon size={20} />
            <div>
              <b>{t.title}</b>
              <p>{t.text}</p>
            </div>
            <button
              className="icon-btn icon-btn--small"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Hinweis schließen"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
