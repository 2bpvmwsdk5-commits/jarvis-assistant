# J.A.R.V.I.S. – Persönlicher KI-Assistent

Ein futuristischer, persönlicher Assistent im Lila-Design – inspiriert von JARVIS aus Iron Man.
Läuft im Browser auf **iPhone, iPad und Desktop**.

![Version](https://img.shields.io/badge/Version-1.2-a855f7)

## Was JARVIS kann

| Funktion                | So geht's                                                                  |
| ----------------------- | -------------------------------------------------------------------------- |
| Persönliche Begrüßung   | Beim Start begrüßt JARVIS Sie mit Namen, passend zur Tageszeit             |
| Chat                    | Nachricht ins Feld rechts (Handy: Tab „Chat“) tippen                        |
| Sprachsteuerung         | Mikrofon-Knopf oder direkt auf den leuchtenden Kern tippen                 |
| Sprachausgabe           | JARVIS liest Antworten vor (Lautsprecher-Symbol oben schaltet das um)      |
| Uhrzeit & Datum         | Live oben in der Mitte                                                     |
| Aufgaben & Erinnerungen | Im Aufgaben-Bereich – oder per Sprache/Chat (siehe unten)                  |
| Einstellungen           | Zahnrad oben rechts: Name, Stimme, Tempo, Tonhöhe, Begrüßung              |

### Beispiel-Befehle

- „Neue Aufgabe: Wäsche waschen“
- „Erinnere mich um 15:30 an den Anruf“
- „Erinnere mich in 10 Minuten an den Tee“
- „Erinnere mich morgen um 8 an den Zahnarzt“
- „Welche Aufgaben habe ich?“
- „Wie spät ist es?“ · „Welcher Tag ist heute?“ · „Was kannst du?“

## Als App installieren

JARVIS lässt sich wie eine echte App installieren – mit eigenem Symbol, im Vollbild und
auch ohne Internet startbar (Aufgaben, Erinnerungen und Uhrzeit funktionieren offline).

- **iPhone / iPad:** In **Safari** öffnen → **Teilen** (□↑) → **„Zum Home-Bildschirm“** → **„Hinzufügen“**
- **Android / Chrome / Edge:** Zahnrad → App → **„JARVIS installieren“** (oder Browser-Menü → „App installieren“)

Die Anleitung steht auch in JARVIS unter Zahnrad → **App**.

## Auf dem eigenen Computer starten

Voraussetzung: [Node.js](https://nodejs.org) (Version 20 oder neuer).

```bash
npm install        # einmalig: Bausteine herunterladen
npm run dev        # Entwicklungsmodus starten
```

Dann im Browser **http://localhost:3000** öffnen.

Weitere Befehle:

```bash
npm test           # automatische Tests ausführen
npm run lint       # Code-Qualität prüfen
npm run build      # fertige Version bauen
npm start          # fertige Version starten
```

## Echte KI (Claude) aktivieren – optional

Ohne Einstellungen nutzt JARVIS ein **lokales Modul** (funktioniert sofort, kostenlos).
Mit Claude beantwortet JARVIS fast jede Frage – Wort für Wort live, und er kennt
Uhrzeit sowie Ihre offenen Aufgaben („Was steht heute an?“).

Dafür werden drei Werte benötigt:

| Name                 | Wert                                                    |
| -------------------- | ------------------------------------------------------- |
| `JARVIS_AI_PROVIDER` | `claude`                                                |
| `ANTHROPIC_API_KEY`  | Ihr Schlüssel von https://platform.claude.com           |
| `JARVIS_ACCESS_CODE` | Ein selbst ausgedachter Zugangscode (z. B. `Lila-Kern-2026`) |

- **Online (Netlify):** Site configuration → Environment variables → die drei Werte anlegen →
  danach unter „Deploys“ → „Trigger deploy“ neu veröffentlichen.
- **Lokal:** `.env.example` zu `.env.local` kopieren, Werte eintragen, Server neu starten.

Anschließend in JARVIS: Zahnrad → System → **Zugangscode** eingeben (einmal pro Gerät).

> 💶 Claude kostet je nach Nutzung (meist wenige Cent pro Gespräch). Ohne Zugangscode
> bleibt Claude aus Sicherheitsgründen deaktiviert. Tipp: In der Claude-Konsole ein
> monatliches Ausgabenlimit festlegen.

> 🔒 **Sicherheit:** `.env.local` wird nie ins Repository hochgeladen. Der Schlüssel bleibt auf
> dem Server und erreicht nie den Browser. Beim Hosting (z. B. Vercel) tragen Sie die Werte
> im Dashboard unter „Environment Variables“ ein – niemals im Code.

## Online stellen (Cloud)

Am einfachsten mit [Vercel](https://vercel.com): Repository verbinden → „Deploy“.
Ebenso möglich: Netlify, Render, Railway oder jeder Server mit Node.js (`npm run build && npm start`).

> Mikrofon und Sprachausgabe funktionieren nur über **https** (oder lokal über `localhost`).

## Projektstruktur

```
src/
├── app/
│   ├── api/chat/route.ts   Server-Schnittstelle: hier „denkt“ JARVIS
│   ├── layout.tsx          Seitengerüst, Schriften
│   ├── page.tsx            Startseite
│   └── globals.css         Komplettes Design (Farben, Leuchten, Animationen)
├── components/             Sichtbare Bausteine (Kern, Chat, Aufgaben, Einstellungen …)
├── hooks/                  Browser-Logik (Speicher, Mikrofon, Stimme, Uhr)
└── lib/
    ├── ai/                 Austauschbares KI-Gehirn (lokal + Claude)
    ├── commands.ts         Versteht Befehle wie „Erinnere mich …“
    └── types.ts            Datentypen
```

Den vollständigen Plan und Fahrplan finden Sie in [`docs/ENTWICKLUNGSPLAN.md`](docs/ENTWICKLUNGSPLAN.md).

## Hinweise

- **Daten** (Aufgaben, Chat, Einstellungen) werden in Version 1.0 nur auf dem jeweiligen Gerät gespeichert.
- **Spracherkennung** funktioniert in Chrome, Edge und Safari. Firefox unterstützt sie (noch) nicht –
  dort wird der Mikrofon-Knopf ausgeblendet.
- **Erinnerungen** erscheinen, solange JARVIS im Browser geöffnet ist.
- Lexware- und Bankverbindungen sind bewusst **noch nicht** enthalten.
