/**
 * Sanfter, futuristischer Signalton – direkt im Browser erzeugt (keine Audiodatei nötig).
 *
 * Wichtig für iPhone/iPad: Ein dauerhaft geöffneter Tonkanal (AudioContext) kann dort
 * das Mikrofon blockieren. Deshalb wird der Kanal nur kurz geöffnet und danach sofort
 * wieder pausiert. Vor dem Zuhören ruft JARVIS zusätzlich suspendAudio() auf.
 */

let ctx: AudioContext | null = null;
let suspendTimer: ReturnType<typeof setTimeout> | undefined;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Tonkanal nach einer kurzen Wartezeit wieder schließen (pausieren). */
function scheduleSuspend(afterMs: number) {
  clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => {
    ctx?.suspend().catch(() => {});
  }, afterMs);
}

/** Tonkanal sofort pausieren – z. B. bevor das Mikrofon startet. */
export function suspendAudio() {
  clearTimeout(suspendTimer);
  if (ctx && ctx.state === "running") ctx.suspend().catch(() => {});
}

/**
 * Muss durch eine Berührung/einen Klick ausgelöst werden (z. B. beim Stellen eines Timers),
 * damit iOS den Ton später erlaubt. Danach wird der Kanal gleich wieder pausiert.
 */
export function unlockAudio() {
  const c = getContext();
  if (!c) return;
  c.resume().catch(() => {});
  try {
    const buffer = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* ohne Ton geht es auch */
  }
  scheduleSuspend(400);
}

function tone(c: AudioContext, freq: number, start: number, length: number, volume: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

/** Drei aufsteigende Klänge, dreimal wiederholt (ca. 3,5 Sekunden). */
export function playChime(repeats = 3) {
  const c = getContext();
  if (!c) return;
  c.resume()
    .then(() => {
      const notes = [659.25, 987.77, 1318.51]; // E5 – H5 – E6
      for (let r = 0; r < repeats; r++) {
        const base = c.currentTime + 0.05 + r * 1.2;
        notes.forEach((f, i) => tone(c, f, base + i * 0.14, 0.9, 0.18));
      }
      scheduleSuspend(repeats * 1200 + 1200);
    })
    .catch(() => {});
}
