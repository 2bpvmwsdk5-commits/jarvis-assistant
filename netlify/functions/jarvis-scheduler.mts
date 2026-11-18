/**
 * Netlify Scheduled Function – läuft jede Minute auf dem Server.
 * Verschickt fällige Erinnerungen, Timer und den Morgenbericht.
 */
import { runScheduler } from "../../src/lib/push/scheduler";
import { getKeyValueStore } from "../../src/lib/push/store";

const scheduler = async () => {
  const report = await runScheduler(getKeyValueStore());
  if (report.sent || report.briefings || report.removedSubscriptions) {
    console.log("[JARVIS] Taktgeber:", JSON.stringify(report));
  }
};

export default scheduler;

export const config = { schedule: "* * * * *" };
