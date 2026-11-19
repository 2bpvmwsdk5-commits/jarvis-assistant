"use client";

import { useEffect, useState } from "react";
import type { ChatApiStatus, Memory, Settings } from "@/lib/types";
import type { useInstall } from "@/hooks/useInstall";
import type { useDeviceAi } from "@/hooks/useDeviceAi";
import type { usePush } from "@/hooks/usePush";
import { CloseIcon, TrashIcon, VolumeIcon } from "./Icons";

interface SettingsPanelProps {
  open: boolean;
  settings: Settings;
  voices: SpeechSynthesisVoice[];
  speechSupported: boolean;
  installer: ReturnType<typeof useInstall>;
  deviceAi: ReturnType<typeof useDeviceAi>;
  memories: Memory[];
  push: ReturnType<typeof usePush>;
  onEnablePush: () => void;
  onDeleteMemory: (id: string) => void;
  onChange: (patch: Partial<Settings>) => void;
  onTestVoice: () => void;
  onClearChat: () => void;
  onResetAll: () => void;
  onClose: () => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  local: "Lokales Modul (ohne Internet-KI)",
  claude: "Claude (Anthropic)",
  groq: "Groq (gpt-oss)",
};

export function SettingsPanel({
  open,
  settings,
  voices,
  speechSupported,
  installer,
  deviceAi,
  memories,
  onDeleteMemory,
  push,
  onEnablePush,
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
            <legend>KI-Modul</legend>
            {status === null ? (
              <p className="hint">Prüfe KI-Modul …</p>
            ) : status !== "offline" && status.provider === "groq" ? (
              <p className="install-ok">
                ✓ Groq ist aktiv – JARVIS beantwortet freie Fragen mit einer leistungsstarken KI. Der Schlüssel liegt
                sicher auf dem Server.
              </p>
            ) : status !== "offline" && status.provider === "claude" ? (
              <p className="install-ok">✓ Claude ist aktiv.</p>
            ) : (
              <>
                <p className="hint">
                  Das KI-Modul ist noch nicht eingerichtet. Dafür wird der Groq-Schlüssel bei Netlify als
                  Umgebungsvariable <b>GROQ_API_KEY</b> hinterlegt – er bleibt dort auf dem Server und ist im Browser nie
                  sichtbar.
                </p>
                <ol className="install-steps">
                  <li>
                    Schlüssel unter{" "}
                    <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="link">
                      console.groq.com/keys
                    </a>{" "}
                    erstellen.
                  </li>
                  <li>
                    Bei Netlify: <b>Project configuration → Environment variables</b> → <b>GROQ_API_KEY</b> anlegen.
                  </li>
                  <li>
                    <b>Deploys → Trigger deploy</b> und JARVIS danach neu öffnen.
                  </li>
                </ol>
              </>
            )}
          </fieldset>

          <fieldset className="settings__group">
            <legend>Benachrichtigungen</legend>
            {!push.supported || (installer.ios && !installer.standalone) ? (
              <p className="hint">
                {installer.ios
                  ? "Auf iPhone und iPad funktionieren Benachrichtigungen nur in der installierten App: JARVIS über „Teilen → Zum Home-Bildschirm“ hinzufügen und von dort öffnen."
                  : "Dieser Browser unterstützt keine Benachrichtigungen."}
              </p>
            ) : push.subscribed ? (
              <>
                <p className="install-ok">✓ Aktiv – Erinnerungen und Timer melden sich auch bei geschlossener App.</p>
                <div className="settings__actions">
                  <button className="btn btn--ghost" onClick={push.sendTest} disabled={push.busy}>
                    Test senden
                  </button>
                  <button className="btn btn--ghost" onClick={push.disable} disabled={push.busy}>
                    Ausschalten
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="hint">
                  JARVIS meldet sich mit Erinnerungen, Timern und dem Morgenbericht – auch wenn die App geschlossen ist.
                </p>
                <button className="btn btn--primary" onClick={onEnablePush} disabled={push.busy}>
                  {push.busy ? "Einen Moment …" : "Benachrichtigungen aktivieren"}
                </button>
              </>
            )}
            {push.info && <p className="install-ok">{push.info}</p>}
            {push.error && <p className="hint hint--error">{push.error}</p>}

            <Toggle
              label="Morgenbericht"
              checked={settings.briefingEnabled}
              onChange={(v) => onChange({ briefingEnabled: v })}
            />
            {settings.briefingEnabled && (
              <>
                <label className="field">
                  <span>Uhrzeit</span>
                  <input
                    className="input"
                    type="time"
                    value={settings.briefingTime}
                    onChange={(e) => onChange({ briefingTime: e.target.value || "07:30" })}
                  />
                </label>
                <label className="field">
                  <span>Stadt für das Wetter (optional)</span>
                  <input
                    className="input"
                    value={settings.briefingCity}
                    onChange={(e) => onChange({ briefingCity: e.target.value.slice(0, 60) })}
                    placeholder="z. B. Berlin"
                    autoComplete="address-level2"
                  />
                </label>
                <p className="hint">
                  Jeden Morgen: Wetter, heutige Erinnerungen, offene Aufgaben und der nächste Countdown.
                  {!push.subscribed && " Dafür bitte oben die Benachrichtigungen aktivieren."}
                </p>
              </>
            )}
          </fieldset>

          <fieldset className="settings__group">
            <legend>Gedächtnis</legend>
            <p className="hint">
              Sagen Sie z. B. <b>„Merke dir, dass ich Katzen mag“</b>. JARVIS berücksichtigt das in Gesprächen.
              „Vergiss …“ löscht einen Eintrag wieder. Alles bleibt auf diesem Gerät gespeichert.
            </p>
            {memories.length === 0 ? (
              <p className="hint">Noch nichts gemerkt.</p>
            ) : (
              <ul className="memory-list">
                {memories.map((m) => (
                  <li key={m.id}>
                    <span>{m.text}</span>
                    <button
                      className="icon-btn icon-btn--small"
                      onClick={() => onDeleteMemory(m.id)}
                      aria-label={`„${m.text}“ vergessen`}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
            <legend>KI im Gerät · Experiment</legend>
            <p className="hint">
              Eine kleine KI läuft direkt auf diesem Gerät – kostenlos und privat. Beim ersten Einschalten wird sie
              einmalig heruntergeladen (ca. 700 MB, am besten im WLAN). Sie ist einfacher als große KIs und kann sich
              irren. Benötigt ein neueres Gerät (iPhone/iPad mit iOS 26 oder einen aktuellen Computer).
            </p>
            {status !== null && status !== "offline" && (status.provider === "groq" || status.provider === "claude") && (
              <p className="install-ok">
                Nicht nötig – Sie nutzen bereits {status.provider === "groq" ? "Groq" : "Claude"} (besser und schneller).
                Diese Funktion bleibt deshalb aus.
              </p>
            )}
            <Toggle
              label="KI im Gerät verwenden"
              checked={settings.deviceAi}
              onChange={(v) => onChange({ deviceAi: v })}
            />
            {settings.deviceAi && (
              <div className={`device-ai device-ai--${deviceAi.status}`} role="status">
                {deviceAi.status === "loading" && (
                  <div className="progress" aria-hidden="true">
                    <i style={{ width: `${Math.round(deviceAi.progress * 100)}%` }} />
                  </div>
                )}
                <p>
                  {deviceAi.status === "ready"
                    ? "✓ Bereit – JARVIS antwortet jetzt mit der KI im Gerät."
                    : deviceAi.status === "off"
                      ? "Startet nach „System starten“."
                      : deviceAi.message}
                </p>
              </div>
            )}
            {deviceAi.downloaded && (
              <button
                className="btn btn--ghost"
                onClick={() => {
                  if (window.confirm("Heruntergeladene KI vom Gerät löschen (gibt ca. 700 MB frei)?")) {
                    onChange({ deviceAi: false });
                    deviceAi.remove();
                  }
                }}
              >
                Heruntergeladene KI löschen
              </button>
            )}
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
                {settings.deviceAi && deviceAi.status === "ready"
                  ? "KI im Gerät (Llama 3.2)"
                  : status === null
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
              <b>2.2</b>
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
