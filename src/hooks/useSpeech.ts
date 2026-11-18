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

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Spracherkennung wird von diesem Browser nicht unterstützt.");
      return;
    }
    recognitionRef.current?.abort();
    const rec = new Ctor();
    rec.lang = "de-DE";
    rec.continuous = false;
    rec.interimResults = true;

    let finalText = "";
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(finalText + interimText);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Mikrofon-Zugriff wurde nicht erlaubt. Bitte in den Browser-Einstellungen freigeben.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Die Spracherkennung hatte ein Problem. Bitte noch einmal versuchen.");
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalText.trim();
      if (text) onFinalRef.current(text);
    };

    recognitionRef.current = rec;
    setError(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

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

export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
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
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      if (!supported || !text) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickBestVoice(synth.getVoices(), options.voiceName);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "de-DE";
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      synth.speak(utterance);
    },
    [supported],
  );

  const germanVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("de"));

  return { supported, voices: germanVoices.length ? germanVoices : voices, speaking, speak, cancel };
}
