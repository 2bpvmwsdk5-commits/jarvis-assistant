/**
 * Holografischer Hintergrund: Lichtnebel, perspektivisches Gitter,
 * schwebende Lichtpartikel und eine sanfte Scan-Linie.
 * Die Partikel-Positionen sind fest berechnet (kein Zufall), damit
 * Server und Browser exakt dasselbe anzeigen.
 */

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37.7) % 100,
  delay: (i * 1.37) % 14,
  duration: 12 + ((i * 7) % 11),
  size: 1.5 + ((i * 13) % 4) * 0.8,
}));

export function HoloBackground() {
  return (
    <div className="holo-bg" aria-hidden="true">
      <div className="holo-bg__nebula holo-bg__nebula--a" />
      <div className="holo-bg__nebula holo-bg__nebula--b" />
      <div className="holo-bg__grid" />
      <div className="holo-bg__particles">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDelay: `-${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="holo-bg__scan" />
      <div className="holo-bg__vignette" />
    </div>
  );
}
