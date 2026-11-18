# JARVIS – Entwicklungsplan

Ein futuristischer, persönlicher KI-Assistent im Lila-Design – inspiriert von JARVIS aus Iron Man.

---

## 1. Vision

JARVIS ist eine Web-App, die auf **iPhone, iPad und Desktop** läuft. Im Zentrum
pulsiert ein leuchtender KI-Kern. Man kann mit JARVIS schreiben oder sprechen,
JARVIS antwortet mit Stimme, verwaltet Aufgaben und Erinnerungen und kennt die
persönlichen Einstellungen seiner Nutzerin.

## 2. Designsprache

| Element          | Umsetzung                                                        |
| ---------------- | ---------------------------------------------------------------- |
| Hintergrund      | Fast-Schwarz mit tiefem Violett-Schimmer (`#07030f` → `#12062a`)  |
| Hauptfarben      | Lila `#8b3dff`, Violett `#a855f7`, Lavendel `#d8b4fe`             |
| Neon-Akzent      | `#c084fc` mit weichem Glow (`box-shadow`, `drop-shadow`)          |
| KI-Kern          | Mehrere rotierende Ringe (SVG + CSS), pulsierender Mittelpunkt    |
| Holografie       | Glas-Panels (`backdrop-filter: blur`), feine Linien, Scan-Effekt  |
| Schrift          | „Orbitron“ für Titel, „Inter“ für Text (Google Fonts via Next.js) |
| Regel            | **Keine Blautöne** – alle Farben liegen im Lila-Spektrum          |

Der KI-Kern hat **Zustände**: `idle` (ruhig atmend), `listening` (hört zu),
`thinking` (denkt nach, schnelle Rotation), `speaking` (spricht, pulsiert stark).

## 3. Funktionen – Version 1.0

1. **Persönliche Begrüßung** – je nach Tageszeit („Guten Morgen, …“), gesprochen und geschrieben.
2. **Chat** – Nachrichtenverlauf, Eingabefeld, Antworten von JARVIS.
3. **Sprachsteuerung** – Mikrofon-Taste, Spracherkennung über die Web Speech API des Browsers.
4. **Sprachausgabe** – natürliche Stimme über die Speech Synthesis API (deutsche Stimme wählbar).
5. **Uhrzeit & Datum** – live im Kopfbereich.
6. **Aufgaben & Erinnerungen** – anlegen, abhaken, löschen; Erinnerungen mit Uhrzeit lösen eine Benachrichtigung aus.
   Auch per Chat: „Erinnere mich um 15:30 an den Anruf“ oder „Neue Aufgabe: Einkaufen“.
7. **Einstellungen** – Name, Stimme, Sprechtempo, Sprachausgabe an/aus, Begrüßung an/aus.
8. **Responsive** – eigenes Layout für Handy (Tabs unten), Tablet und Desktop (drei Spalten).

## 4. Technik

| Bereich          | Entscheidung                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| Framework        | **Next.js 16** (App Router) mit **React 19**                                  |
| Sprache          | **TypeScript** (strikter Modus)                                               |
| Styling          | Eigenes CSS mit CSS-Variablen (Design-Tokens) – keine schweren Bibliotheken   |
| Datenspeicher v1 | `localStorage` im Browser (Aufgaben, Einstellungen, Chatverlauf)              |
| KI-Schnittstelle | Server-Route `/api/chat` mit austauschbarem „Gehirn“ (Provider-Muster)        |
| KI v1            | Lokales Regelwerk (funktioniert ohne Internet-Schlüssel)                     |
| KI später        | Claude (Anthropic) – bereits vorbereitet, aktiviert sich durch API-Schlüssel |
| Geheimnisse      | Nur in Umgebungsvariablen (`.env.local`, Hosting-Dashboard) – nie im Code    |
| Tests            | Vitest für die Logik (Befehlserkennung, lokales Gehirn)                       |
| Hosting          | Cloud-kompatibel, z. B. Vercel, Netlify, Docker / jeder Node-Server          |

### Projektstruktur

```
jarvis-assistant/
├── docs/                    Dokumentation (dieser Plan)
├── src/
│   ├── app/
│   │   ├── api/chat/        Server-Schnittstelle für Chat (KI-Anbindung)
│   │   ├── layout.tsx       Grundgerüst der Seite, Schriften, Metadaten
│   │   ├── page.tsx         Startseite
│   │   └── globals.css      Design-System (Farben, Glow, Animationen)
│   ├── components/          Sichtbare Bausteine (KI-Kern, Chat, Uhr, Aufgaben …)
│   ├── hooks/               Wiederverwendbare Logik (Sprache, Speicher)
│   └── lib/
│       ├── ai/              „Gehirn“ von JARVIS (lokal + Claude)
│       ├── commands.ts      Erkennt Befehle wie „Erinnere mich …“
│       └── types.ts         Gemeinsame Datentypen
├── .env.example             Vorlage für geheime Schlüssel (ohne echte Werte)
└── README.md                Anleitung
```

### Sicherheit

- API-Schlüssel stehen **nur auf dem Server** (`process.env`) und gelangen nie in den Browser.
- `.env.local` ist per `.gitignore` vom Repository ausgeschlossen.
- Eingaben an `/api/chat` werden in Länge und Format geprüft.
- Sicherheits-Header (z. B. `X-Content-Type-Options`, `Referrer-Policy`, Mikrofon nur für die eigene Seite).

## 5. Fahrplan

| Version | Inhalt                                                                                   |
| ------- | ---------------------------------------------------------------------------------------- |
| **1.0** | Design, KI-Kern, Chat, Sprache ein/aus, Uhr, Aufgaben/Erinnerungen, Einstellungen        |
| 1.1 ✅  | Claude als echtes Gehirn, Antworten als Stream, Zugangscode-Schutz, Kontext (Zeit, Aufgaben) |
| 1.2 ✅  | Installierbar als App (PWA), Offline-Modus, App-Icon auf dem Home-Bildschirm             |
| 1.3 ✅  | Timer (mit Signalton & Ansage) und Countdowns (Feiertage, Daten, gespeicherte Termine)   |
| 1.4 🧪  | Experiment: kostenlose KI direkt im Gerät (WebGPU, Llama 3.2 1B) mit Absturz-Sicherung   |
| 1.5 ✅  | Kostenlose Cloud-KI: Google Gemini (Gratis-Kontingent), läuft auf jedem Gerät            |
| 2.0     | Benutzerkonto & Cloud-Datenbank (Daten auf allen Geräten), Kalender-Anbindung            |
| 2.x     | Weitere Integrationen (z. B. Wetter, E-Mail) – **Lexware/Bank erst nach Freigabe**       |

## 6. Bewusst noch nicht enthalten

- Keine Lexware- oder Bankverbindungen.
- Keine Benutzerkonten – die Daten bleiben vorerst nur auf dem jeweiligen Gerät.
