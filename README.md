# J.A.R.V.I.S. – Persönlicher KI-Assistent

Ein futuristischer, persönlicher Assistent im Lila-Design – inspiriert von JARVIS aus Iron Man.
Läuft im Browser auf **iPhone, iPad und Desktop**.

![Version](https://img.shields.io/badge/Version-1.5-a855f7)

## Was JARVIS kann

| Funktion                | So geht's                                                                  |
| ----------------------- | -------------------------------------------------------------------------- |
| Persönliche Begrüßung   | Beim Start begrüßt JARVIS Sie mit Namen, passend zur Tageszeit             |
| Chat                    | Nachricht ins Feld rechts (Handy: Tab „Chat“) tippen                        |
| Sprachsteuerung         | Mikrofon-Knopf oder direkt auf den leuchtenden Kern tippen                 |
| Sprachausgabe           | JARVIS liest Antworten vor (Lautsprecher-Symbol oben schaltet das um)      |
| Uhrzeit & Datum         | Live oben in der Mitte                                                     |
| Aufgaben & Erinnerungen | Im Aufgaben-Bereich – oder per Sprache/Chat (siehe unten)                  |
| Timer                   | Schnellstart-Knöpfe im Bereich „Zeit“ (Handy: Tab „Zeit“) – oder per Sprache |
| Countdowns              | Tage bis zu einem Datum zählen und wichtige Termine speichern             |
| Einstellungen           | Zahnrad oben rechts: Name, Stimme, Tempo, Tonhöhe, Begrüßung              |

### Beispiel-Befehle

- „Neue Aufgabe: Wäsche waschen“
- „Erinnere mich um 15:30 an den Anruf“
- „Erinnere mich in 10 Minuten an den Tee“
- „Erinnere mich morgen um 8 an den Zahnarzt“
- „Welche Aufgaben habe ich?“
- „Timer auf 10 Minuten“ · „Timer für die Nudeln auf 8 Minuten“ · „Weck mich in 20 Minuten“
- „Wie lange läuft der Timer noch?“ · „Timer stoppen“
- „Wie viele Tage bis Weihnachten?“ · „Wie lange noch bis zum 1. Juli?“
- „Countdown: Urlaub am 1. Juli“ · „Wie viele Tage bis zu meinem Urlaub?“
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

## Echte KI kostenlos: Google Gemini (empfohlen)

Funktioniert auf jedem Gerät (auch älteren iPads), da die KI bei Google läuft.

1. Auf **https://aistudio.google.com** mit einem Google-Konto anmelden → **„Get API key“** →
   **„Create API key“** → Schlüssel kopieren. **Keine Zahlungsdaten eingeben** – dann bleibt es kostenlos.
2. Bei **Netlify**: Project configuration → Environment variables → **Add a variable** →
   Key `GEMINI_API_KEY`, Value = Ihr Schlüssel.
3. Deploys → **Trigger deploy** → Deploy site.

Fertig – unter Zahnrad → System steht dann „KI-Modul: Gemini (Google, kostenlos)“.

> Hinweise: Das Gratis-Kontingent ist begrenzt (Anfragen pro Minute/Tag). Ist es aufgebraucht,
> sagt JARVIS Bescheid; Timer, Aufgaben und Erinnerungen funktionieren immer. Bei kostenlosen
> Konten darf Google die Chat-Inhalte zur Verbesserung seiner Dienste verwenden – daher keine
> sensiblen Daten (Passwörter, Bankdaten, Gesundheitsdaten) eingeben.

## KI im Gerät – kostenlos (Experiment)

Unter Zahnrad → **KI im Gerät** lässt sich eine kleine KI (Llama 3.2, 1B) einschalten, die
**direkt auf dem Gerät** läuft – kostenlos, ohne Konto, ohne Server.

- Einmaliger Download von ca. **700 MB** (am besten im WLAN), danach aus dem Gerätespeicher.
- Benötigt **WebGPU**: iPhone/iPad mit **iOS/iPadOS 26** oder ein aktueller Chrome/Edge/Safari am Computer.
- Geräte mit wenig Arbeitsspeicher (z. B. 4 GB) sind ein Grenzfall. Stürzt das Laden ab,
  schaltet JARVIS die Funktion beim nächsten Start automatisch aus.
- Die KI ist deutlich einfacher als große Cloud-KIs und kann sich irren.
- Speicher freigeben: Zahnrad → KI im Gerät → „Heruntergeladene KI löschen“.

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
