"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeWhen, formatDate, formatTime, greetingFor, parseCommand, type Command } from "@/lib/commands";
import { DEFAULT_SETTINGS, type ChatMessage, type CoreState, type Settings, type Task } from "@/lib/types";
import { useIsClient, usePersistentState } from "@/hooks/usePersistentState";
import { useSpeechRecognition, useSpeechSynthesis } from "@/hooks/useSpeech";
import { AICore, STATE_LABEL } from "./AICore";
import { BootScreen } from "./BootScreen";
import { ChatPanel } from "./ChatPanel";
import { ClockDisplay } from "./ClockDisplay";
import { HoloBackground } from "./HoloBackground";
import { BellIcon, ChatIcon, CloseIcon, ListIcon, MicIcon, MuteIcon, SettingsIcon, VolumeIcon } from "./Icons";
import { SettingsPanel } from "./SettingsPanel";
import { TasksPanel } from "./TasksPanel";

const MAX_STORED_MESSAGES = 100;
const SUGGESTIONS = [
  "Was kannst du?",
  "Wie spät ist es?",
  "Erinnere mich in 5 Minuten an den Tee",
  "Neue Aufgabe: Einkaufen",
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

  const [booted, setBooted] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "tasks">("chat");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const tts = useSpeechSynthesis();
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
          try {
            new Notification("JARVIS – Erinnerung", { body: t.title });
          } catch {
            /* manche mobilen Browser erlauben das nur als installierte App */
          }
        }
      }
    };
    check();
    const timer = setInterval(check, 10_000);
    return () => clearInterval(timer);
  }, [booted, tasks, setTasks, pushToast, jarvisSays, settings.userName]);

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
          return "Ich kann mit Ihnen sprechen, Aufgaben notieren und Sie erinnern. Sagen Sie zum Beispiel: „Neue Aufgabe: Wäsche waschen“, „Erinnere mich um 15 Uhr an den Anruf“, „Welche Aufgaben habe ich?“ oder fragen Sie nach der Uhrzeit.";
      }
    },
    [addTask, tasks],
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
        const msg = "Verbindung zum Kernsystem unterbrochen. Bitte versuchen Sie es gleich noch einmal.";
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
      </main>

      <nav className="tabbar" aria-label="Bereiche">
        <button aria-current={mobileTab === "chat"} onClick={() => setMobileTab("chat")}>
          <ChatIcon /> Chat
        </button>
        <button aria-current={mobileTab === "tasks"} onClick={() => setMobileTab("tasks")}>
          <ListIcon /> Aufgaben {openTasks.length > 0 && <b className="badge">{openTasks.length}</b>}
        </button>
      </nav>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        voices={tts.voices}
        speechSupported={tts.supported}
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
