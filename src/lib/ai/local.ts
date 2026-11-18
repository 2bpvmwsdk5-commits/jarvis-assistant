import type { AiProvider } from "./provider";

/**
 * Lokales Gehirn: einfache, regelbasierte Antworten.
 * Funktioniert komplett ohne Internet-Schlüssel – ideal für Version 1.0.
 */

interface Rule {
  test: RegExp;
  answers: (name: string) => string[];
}

const RULES: Rule[] = [
  {
    test: /^(hallo|hi|hey|servus|moin|guten (morgen|tag|abend)|grüß dich)\b/,
    answers: (n) => [
      `Hallo${n ? ` ${n}` : ""}. Alle Systeme sind online. Wie kann ich helfen?`,
      `Schön, Sie zu hören${n ? `, ${n}` : ""}. Was steht an?`,
    ],
  },
  {
    test: /wie geht('?s| es dir)|alles (gut|klar) bei dir/,
    answers: () => [
      "Mir geht es ausgezeichnet. Alle Systeme laufen mit optimaler Leistung.",
      "Bestens, danke der Nachfrage. Meine Schaltkreise leuchten heute besonders lila.",
    ],
  },
  {
    test: /wer bist du|wie heißt du|was bist du|stell dich vor/,
    answers: () => [
      "Ich bin JARVIS, Ihr persönlicher digitaler Assistent. Ich verwalte Aufgaben, Erinnerungen und stehe Ihnen jederzeit zur Seite.",
    ],
  },
  {
    test: /wofür steht jarvis|was bedeutet jarvis/,
    answers: () => ["JARVIS steht für „Just A Rather Very Intelligent System“ – ein ziemlich intelligentes System."],
  },
  {
    test: /\b(danke|dankeschön|vielen dank|merci)\b/,
    answers: (n) => ["Sehr gern geschehen.", `Immer zu Diensten${n ? `, ${n}` : ""}.`],
  },
  {
    test: /witz|lustig|bring mich zum lachen/,
    answers: () => [
      "Warum sitzen Programmierer im Dunkeln? Weil Licht Bugs anzieht.",
      "Ich wollte einen Witz über Lila erzählen – aber der ist zu violett-schräg.",
      "Was macht ein Roboter am Strand? Er sammelt Sand-Bytes.",
    ],
  },
  {
    test: /\b(tschüss|bis später|auf wiedersehen|gute nacht|ciao)\b/,
    answers: (n) => [`Bis bald${n ? `, ${n}` : ""}. Ich halte die Stellung.`],
  },
  {
    test: /wetter/,
    answers: () => [
      "Die Wetterdaten sind noch nicht angebunden. Das steht auf meinem Entwicklungsplan für eine der nächsten Versionen.",
    ],
  },
  {
    test: /\b(lexware|bank|konto|überweisung)\b/,
    answers: () => [
      "Finanz- und Bankverbindungen sind bewusst noch nicht aktiviert. Sobald Sie es freigeben, kann ich das später einrichten.",
    ],
  },
];

const FALLBACKS = [
  "Verstanden. Mein volles KI-Modul ist noch nicht aktiviert, daher kann ich darauf noch nicht ausführlich antworten. Ich kann aber Aufgaben und Erinnerungen für Sie verwalten – sagen Sie zum Beispiel: „Erinnere mich in 10 Minuten an den Tee“.",
  "Interessante Frage. Dafür brauche ich mein erweitertes KI-Modul, das in einer kommenden Version aktiviert wird. Sagen Sie „Hilfe“, um zu sehen, was ich schon kann.",
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function localAnswer(text: string, userName = ""): string {
  const lower = text.toLowerCase().trim();
  for (const rule of RULES) {
    if (rule.test.test(lower)) return pick(rule.answers(userName));
  }
  return pick(FALLBACKS);
}

export const localProvider: AiProvider = {
  name: "local",
  async *stream(messages, context) {
    const last = [...messages].reverse().find((m) => m.role === "user");
    yield localAnswer(last?.text ?? "", context.userName);
  },
};
