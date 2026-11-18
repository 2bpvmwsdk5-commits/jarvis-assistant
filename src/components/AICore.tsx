import type { CoreState } from "@/lib/types";

/**
 * Der leuchtende KI-Kern – das Herzstück von JARVIS.
 * Die Animationen (Rotation, Pulsieren, Glühen) stecken in globals.css.
 * Je nach Zustand (bereit, hört zu, denkt, spricht) verändert sich der Kern.
 */

const TICKS = Array.from({ length: 72 }, (_, i) => i);
const NODES = Array.from({ length: 6 }, (_, i) => i);

export function AICore({ state, size }: { state: CoreState; size?: string }) {
  return (
    <div className="core" data-state={state} style={size ? { width: size } : undefined}>
      <div className="core__halo" />
      <svg className="core__svg" viewBox="0 0 400 400" role="img" aria-label={`KI-Kern – ${STATE_LABEL[state]}`}>
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="22%" stopColor="#f3e8ff" />
            <stop offset="48%" stopColor="#c084fc" />
            <stop offset="78%" stopColor="#7e22ce" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#3b0764" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="arcGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f0abfc" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6b21a8" />
          </linearGradient>
          <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <path id="textRing" d="M200,200 m-182,0 a182,182 0 1,1 364,0 a182,182 0 1,1 -364,0" />
        </defs>

        {/* Äußerer Schriftring */}
        <g className="core__ring core__ring--text">
          <text className="core__ring-text">
            <textPath href="#textRing">
              J.A.R.V.I.S • PERSONAL INTELLIGENCE SYSTEM • VERSION 1.5 • ALL SYSTEMS ONLINE •
              NEURAL CORE ACTIVE •
            </textPath>
          </text>
        </g>

        {/* Gestrichelter Außenring */}
        <circle className="core__ring core__ring--dots" cx="200" cy="200" r="168" />

        {/* Segmentierter Ring */}
        <circle className="core__ring core__ring--segments" cx="200" cy="200" r="152" filter="url(#neon)" />

        {/* Skala mit Strichen */}
        <g className="core__ring core__ring--ticks">
          {TICKS.map((i) => (
            <line
              key={i}
              x1="200"
              y1={i % 6 === 0 ? 62 : 68}
              x2="200"
              y2="74"
              transform={`rotate(${i * 5} 200 200)`}
              className={i % 6 === 0 ? "tick tick--major" : "tick"}
            />
          ))}
        </g>

        {/* Kräftige Bogen-Segmente */}
        <circle className="core__ring core__ring--arcs" cx="200" cy="200" r="112" filter="url(#neon)" />

        {/* Rotierendes Sechseck mit Knotenpunkten */}
        <g className="core__ring core__ring--hex">
          <polygon points="200,112 276,156 276,244 200,288 124,244 124,156" className="hex" />
          {NODES.map((i) => (
            <circle key={i} cx="200" cy="112" r="3.5" className="node" transform={`rotate(${i * 60} 200 200)`} />
          ))}
        </g>

        {/* Innerer Ring */}
        <circle className="core__ring core__ring--inner" cx="200" cy="200" r="78" />

        {/* Puls-Welle (sichtbar beim Sprechen/Zuhören) */}
        <circle className="core__wave" cx="200" cy="200" r="70" />
        <circle className="core__wave core__wave--2" cx="200" cy="200" r="70" />

        {/* Leuchtender Kern */}
        <circle className="core__heart" cx="200" cy="200" r="66" fill="url(#coreGlow)" />
        <circle className="core__spark" cx="200" cy="200" r="14" />
      </svg>
    </div>
  );
}

export const STATE_LABEL: Record<CoreState, string> = {
  idle: "Bereit",
  listening: "Ich höre zu",
  thinking: "Verarbeite",
  speaking: "Spricht",
};
