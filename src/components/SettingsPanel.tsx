"use client";

import { useEffect, useState } from "react";
import type { ChatApiStatus, Settings } from "@/lib/types";
import type { useInstall } from "@/hooks/useInstall";
import { CloseIcon, VolumeIcon } from "./Icons";

interface SettingsPanelProps {
  open: boolean;
  settings: Settings;
  voices: SpeechSynthesisVoice[];
  speechSupported: boolean;
  installer: ReturnType<typeof useInstall>;
  onChange: (patch: Partial<Settings>) => void;
  onTestVoice: () => void;
  onClearChat: () => void;
  onResetAll: () => void;
  onClose: () => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  local: "Lokales Modul (ohne Internet-KI)",
  claude: "Claude (Anthropic)",
};

export function SettingsPanel({
  open,
  settings,
  voices,
  speechSupported,
  installer,
  onChange,
  onTestVoice,
  onClearChat,
  onResetAll,
  onClose,
}: SettingsPanelProps) {
  const [status, setStatus] = useState<ChatApiStatus | "offline" | null>(null);

  // Welches KI-Gehirn ist auf dem Server aktiv?
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d: ChatApiStatus) => !cancelled && setStatus(d))
      .catch(() => !cancelled && setStatus("offline"));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Mit der Escape-Taste schließen
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`drawer ${open ? "is-open" : ""}`} aria-hidden={!open} inert={!open}>
      <div className="drawer__backdrop" onClick={onClose} />
      <aside className="drawer__panel panel" role="dialog" aria-modal="true" aria-label="Einstellungen">
        <header className="panel__header">
          <h2 className="panel__title">
            <span className="panel__dot" /> Einstellungen
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Einstellungen schließen">
            <CloseIcon />
          </button>
        </header>

        <div className="settings">
          <fieldset className="settings__group">
            <legend>Persönlich</legend>
            <label className="field">
              <span>Wie soll JARVIS Sie nennen?</span>
              <input
                className="input"
                value={settings.userName}
                onChange={(e) => onChange({ userName: e.target.value.slice(0, 40) })}
                placeholder="Ihr Name"
                autoComplete="given-name"
              />
            </label>
            <Toggle
              label="Begrüßung beim Start"
              checked={settings.greetingEnabled}
              onChange={(v) => onChange({ greetingEnabled: v })}
            />
          </fieldset>

          <fieldset className="settings__group">
            <legend>Stimme</legend>
            {!speechSupported && <p className="hint">Dieser Browser unterstützt keine Sprachausgabe.</p>}
            <Toggle
              label="Antworten vorlesen"
              checked={settings.voiceEnabled}
              onChange={(v) => onChange({ voiceEnabled: v })}
            />
            <label className="field">
              <span>Stimme</span>
              <select
                className="input"
                value={settings.voiceName}
                onChange={(e) => onChange({ voiceName: e.target.value })}
                disabled={!voices.length}
              >
                <option value="">Automatisch (beste deutsche Stimme)</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
            <Slider label="Sprechtempo" value={settings.speechRate} onChange={(v) => onChange({ speechRate: v })} />
            <Slider label="Tonhöhe" value={settings.speechPitch} onChange={(v) => onChange({ speechPitch: v })} />
            <button className="btn btn--ghost" onClick={onTestVoice} disabled={!speechSupported}>
              <VolumeIcon size={18} /> Stimme testen
            </button>
            <p className="hint">
              Tipp: Auf iPhone und iPad klingen die Stimmen „Anna (Premium)“ oder „Helena (Premium)“ besonders
              natürlich. Sie lassen sich unter Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen laden.
            </p>
          </fieldset>

          <fieldset className="settings__group">
            <legend>App</legend>
            {installer.standalone ? (
              <p className="install-ok">✓ JARVIS ist als App installiert.</p>
            ) : installer.canPrompt ? (
              <>
                <p className="hint">Installieren Sie JARVIS als App – mit eigenem Symbol und im Vollbild.</p>
                <button className="btn btn--primary" onClick={installer.install}>
                  JARVIS installieren
                </button>
              </>
            ) : installer.ios ? (
              <ol className="install-steps">
                <li>
                  Diese Seite in <b>Safari</b> öffnen.
                </li>
                <li>
                  Unten (iPad: oben) auf <b>Teilen</b> <span aria-hidden="true">□↑</span> tippen.
                </li>
                <li>
                  <b>„Zum Home-Bildschirm“</b> wählen und auf <b>„Hinzufügen“</b> tippen.
                </li>
              </ol>
            ) : (
              <p className="hint">
                Im Browser-Menü <b>„App installieren“</b> bzw. <b>„Zum Startbildschirm hinzufügen“</b> wählen.
              </p>
            )}
          </fieldset>

          <fieldset className="settings__group">
            <legend>System</legend>
            <div className="status-row">
              <span>KI-Modul</span>
              <b>
                {status === null
                  ? "…"
                  : status === "offline"
                    ? "Nicht erreichbar"
                    : (PROVIDER_LABEL[status.provider] ?? status.provider)}
              </b>
            </div>
            {status !== null && status !== "offline" && status.accessCodeRequired && (
              <label className="field">
                <span>Zugangscode für das KI-Modul</span>
                <input
                  className="input"
                  type="password"
                  value={settings.accessCode}
                  onChange={(e) => onChange({ accessCode: e.target.value.slice(0, 100) })}
                  placeholder="Zugangscode eingeben"
                  autoComplete="current-password"
                />
              </label>
            )}
            <div className="status-row">
              <span>Version</span>
              <b>1.2</b>
            </div>
            <div className="settings__actions">
              <button className="btn btn--ghost" onClick={onClearChat}>
                Chatverlauf löschen
              </button>
              <button
                className="btn btn--danger"
                onClick={() => {
                  if (window.confirm("Wirklich alle Daten (Aufgaben, Chat, Einstellungen) löschen?")) onResetAll();
                }}
              >
                Alles zurücksetzen
              </button>
            </div>
          </fieldset>
        </div>
      </aside>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span>
        {label} <b>{value.toFixed(1)}×</b>
      </span>
      <input
        type="range"
        className="range"
        min={0.5}
        max={1.5}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
