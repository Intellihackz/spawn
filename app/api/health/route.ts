// For the host's health check: the web app is up and the database opens. The worker's last tick is reported too.
import { MAX_CHAINS } from "@/lib/caps.ts";
import { getDb, getMeta } from "@/lib/db.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const live = (getDb().prepare("SELECT COUNT(*) AS c FROM chains WHERE status = 'live'").get() as { c: number }).c;
  const tick = Number(getMeta("worker_tick") ?? 0);
  const age = tick ? Math.floor(Date.now() / 1000) - tick : null;
  return Response.json({ ok: true, worker: age === null ? "starting" : age < 60 ? "ok" : "stale", workerAgeSeconds: age, liveChains: live, maxChains: MAX_CHAINS });
}
