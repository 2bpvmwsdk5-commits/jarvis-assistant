"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage } from "@/lib/types";
import { MicIcon, SendIcon, TrashIcon } from "./Icons";

interface ChatPanelProps {
  messages: ChatMessage[];
  thinking: boolean;
  listening: boolean;
  interim: string;
  micSupported: boolean;
  onSend: (text: string) => void;
  onMic: () => void;
  onClear: () => void;
}

export function ChatPanel({
  messages,
  thinking,
  listening,
  interim,
  micSupported,
  onSend,
  onMic,
  onClear,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Automatisch zur neuesten Nachricht scrollen
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking, interim]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <section className="panel chat" aria-label="Chat mit JARVIS">
      <header className="panel__header">
        <h2 className="panel__title">
          <span className="panel__dot" /> Kommunikation
        </h2>
        {messages.length > 0 && (
          <button className="icon-btn icon-btn--small" onClick={onClear} title="Chatverlauf löschen" aria-label="Chatverlauf löschen">
            <TrashIcon size={16} />
          </button>
        )}
      </header>

      <div className="chat__list" ref={listRef} role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="chat__empty">
            Schreiben Sie mir oder tippen Sie auf das Mikrofon. <br />
            Sagen Sie „Hilfe“, um zu sehen, was ich kann.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble bubble--${m.role}`}>
            <span className="bubble__author">{m.role === "jarvis" ? "JARVIS" : "Sie"}</span>
            <p className="bubble__text">{m.text}</p>
          </div>
        ))}
        {listening && interim && (
          <div className="bubble bubble--user bubble--interim">
            <span className="bubble__author">Sie</span>
            <p className="bubble__text">{interim}</p>
          </div>
        )}
        {thinking && (
          <div className="bubble bubble--jarvis bubble--thinking" aria-label="JARVIS denkt nach">
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
      </div>

      <form className="chat__form" onSubmit={submit}>
        {micSupported && (
          <button
            type="button"
            className={`icon-btn mic-btn ${listening ? "is-active" : ""}`}
            onClick={onMic}
            aria-pressed={listening}
            aria-label={listening ? "Zuhören beenden" : "Spracheingabe starten"}
            title={listening ? "Zuhören beenden" : "Spracheingabe"}
          >
            <MicIcon />
          </button>
        )}
        <input
          className="input chat__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={listening ? "Ich höre zu …" : "Nachricht an JARVIS …"}
          aria-label="Nachricht an JARVIS"
          enterKeyHint="send"
          autoComplete="off"
          maxLength={2000}
        />
        <button type="submit" className="icon-btn send-btn" aria-label="Senden" disabled={!draft.trim()}>
          <SendIcon />
        </button>
      </form>
    </section>
  );
}
