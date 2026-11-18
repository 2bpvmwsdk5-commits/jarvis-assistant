"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/* ──────────────────────────────────────────────────────────────
 * Spracherkennung (Mikrofon → Text) über die Web Speech API.
 * Unterstützt in Chrome, Edge und Safari (iPhone/iPad/Mac).
 * ────────────────────────────────────────────────────────────── */

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noopSubscribe = () => () => {};

/** Ohne Ergebnis wird das Zuhören nach dieser Zeit beendet (Sicherung gegen Hängen). */
const SILENCE_TIMEOUT_MS = 10_000;
/** Meldet der Browser das Ende nicht, setzen wir nach dieser Zeit selbst zurück. */
const END_GRACE_MS = 2_500;

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => !!getRecognitionCtor(),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const finishRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const clearWatchdog = () => clearTimeout(watchdogRef.current);

  /** Beendet das Zuhören sicher – auch wenn der Browser nicht mehr reagiert. */
  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      /* ignorieren */
    }
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      try {
        rec.abort();
      } catch {
        /* ignorieren */
      }
      finishRef.current?.();
    }, END_GRACE_MS);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Spracherkennung wird von diesem Browser nicht unterstützt.");
      return;
    }
    // Eine eventuell noch hängende Erkennung hart beenden
    const old = recognitionRef.current;
    if (old) {
      old.onresult = old.onerror = old.onend = null;
      try {
        old.abort();
      } catch {
        /* ignorieren */
      }
    }
    clearWatchdog();

    const rec = new Ctor();
    rec.lang = "de-DE";
    rec.continuous = false;
    rec.interimResults = true;

    let finalText = "";
    let latestText = "";
    let finished = false;

    const armSilenceWatchdog = () => {
      clearWatchdog();
      watchdogRef.current = setTimeout(() => stop(), SILENCE_TIMEOUT_MS);
    };

    // Wird genau einmal aufgerufen – vom Browser (onend) oder von unserer Sicherung
    const finish = () => {
      if (finished) return;
      finished = true;
      clearWatchdog();
      if (recognitionRef.current === rec) recognitionRef.current = null;
      finishRef.current = null;
      setListening(false);
      setInterim("");
      // Safari liefert manchmal kein „final“ – dann nehmen wir das Zwischenergebnis
      const text = (finalText || latestText).trim();
      if (text) onFinalRef.current(text);
    };
    finishRef.current = finish;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      latestText = finalText + interimText;
      setInterim(latestText);
      armSilenceWatchdog();
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Mikrofon-Zugriff wurde nicht erlaubt. Bitte in den Einstellungen des iPhones/Browsers freigeben.");
      } else if (e.error === "audio-capture") {
        setError("Das Mikrofon ist gerade nicht verfügbar (vielleicht nutzt es eine andere App).");
      } else if (e.error === "network") {
        setError("Für die Spracherkennung wird eine Internetverbindung benötigt.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Die Spracherkennung hatte ein Problem. Bitte noch einmal versuchen.");
      }
    };
    rec.onend = finish;

    recognitionRef.current = rec;
    setError(null);
    setInterim("");
    setListening(true);
    try {
      rec.start();
      armSilenceWatchdog();
    } catch {
      finish();
      setError("Die Spracherkennung konnte nicht starten. Bitte noch einmal tippen.");
    }
  }, [stop]);

  useEffect(
    () => () => {
      clearTimeout(watchdogRef.current);
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignorieren */
      }
    },
    [],
  );

  return { supported, listening, interim, error, start, stop };
}

/* ──────────────────────────────────────────────────────────────
 * Sprachausgabe (Text → Stimme) über die Speech Synthesis API.
 * ────────────────────────────────────────────────────────────── */

export interface SpeakOptions {
  voiceName?: string;
  rate?: number;
  pitch?: number;
}

/** Bevorzugte, besonders natürlich klingende deutsche Stimmen (je nach Gerät). */
const PREFERRED_VOICES = [/premium/i, /enhanced|erweitert/i, /natural/i, /google/i, /anna/i, /petra/i, /helena/i, /markus/i];

export function pickBestVoice(voices: SpeechSynthesisVoice[], wanted?: string) {
  if (wanted) {
    const exact = voices.find((v) => v.name === wanted);
    if (exact) return exact;
  }
  const german = voices.filter((v) => v.lang.toLowerCase().startsWith("de"));
  for (const pattern of PREFERRED_VOICES) {
    const match = german.find((v) => pattern.test(v.name));
    if (match) return match;
  }
  return german[0] ?? voices[0];
}

/** Hält gesprochene Sätze fest – sonst „vergisst“ Safari sie und meldet nie das Ende. */
const activeUtterances = new Set<SpeechSynthesisUtterance>();

export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "speechSynthesis" in window,
    () => false,
  );

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const cancel = useCallback(() => {
    clearTimeout(watchdogRef.current);
    if (!supported) return;
    window.speechSynthesis.cancel();
    activeUtterances.clear();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      if (!supported || !text) return;
      const synth = window.speechSynthesis;
      const wasBusy = synth.speaking || synth.pending;
      synth.cancel();
      activeUtterances.clear();
      clearTimeout(watchdogRef.current);

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickBestVoice(synth.getVoices(), options.voiceName);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "de-DE";
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;

      const done = () => {
        clearTimeout(watchdogRef.current);
        activeUtterances.delete(utterance);
        if (!activeUtterances.size) setSpeaking(false);
      };
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = done;
      utterance.onerror = done;
      activeUtterances.add(utterance);

      // Sicherung: Meldet der Browser das Ende nicht, nach geschätzter Sprechdauer zurücksetzen
      const estimatedMs = Math.max(4000, (text.length * 90) / (options.rate ?? 1)) + 4000;
      watchdogRef.current = setTimeout(() => {
        if (activeUtterances.has(utterance)) {
          activeUtterances.delete(utterance);
          setSpeaking(false);
        }
      }, estimatedMs);

      // iOS verschluckt Ansagen, wenn direkt nach cancel() gesprochen wird → kurz warten
      const go = () => {
        if (synth.paused) synth.resume();
        synth.speak(utterance);
      };
      if (wasBusy) setTimeout(go, 120);
      else go();
    },
    [supported],
  );

  useEffect(() => () => clearTimeout(watchdogRef.current), []);

  const germanVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("de"));

  return { supported, voices: germanVoices.length ? germanVoices : voices, speaking, speak, cancel };
}
