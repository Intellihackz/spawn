// Capacity limits. Every chain is a running anvil process that uses memory, and anyone can launch on Pons with our salt tag, so the
// server caps how many chains exist and how many one wallet may have. Both are settings (SPAWN_MAX_CHAINS, SPAWN_MAX_PER_WALLET).
import { getDb } from "./db.ts";

export const MAX_CHAINS = Number(process.env.SPAWN_MAX_CHAINS ?? 100);
export const MAX_PER_WALLET = Number(process.env.SPAWN_MAX_PER_WALLET ?? 5);

/** Why this wallet cannot get another chain right now, or null if it can. */
export function capReason(creator: string): string | null {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) AS c FROM chains WHERE status IN ('live','pending','error')").get() as { c: number }).c;
  if (total >= MAX_CHAINS) return "Spawn is full right now: it runs a limited number of chains. Please come back later.";
  const mine = (db.prepare("SELECT COUNT(*) AS c FROM chains WHERE creator = ? AND status IN ('live','pending','error')").get(creator.toLowerCase()) as { c: number }).c;
  if (mine >= MAX_PER_WALLET) return `This wallet already has ${mine} chains, and the limit is ${MAX_PER_WALLET} per wallet.`;
  return null;
}
