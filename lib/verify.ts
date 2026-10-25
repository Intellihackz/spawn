// The independent check: rebuild the hash chain straight from the Pons logs, and compare it with what we stored and with the ledger itself.
import { createPublicClient, http, parseAbi, type Hex } from "viem";
import { type ChainRow, getDb } from "./db.ts";
import { localRpc } from "./consts.ts";
import { chainOf } from "./hash.ts";
import { tradesOf } from "./pons.ts";

export type Verdict = {
  ok: boolean;
  checkedAt: number;
  ponsTrades: number;
  mirrored: number;
  expectedHead: string;
  storedHead: string | null;
  ledgerHead: string | null;
  firstMismatch: number | null; // 1-based index of the first trade whose hash differs
  reason: string | null;
};

const cache = new Map<number, Verdict>();
const ledgerAbi = parseAbi(["function head() view returns (bytes32)", "function count() view returns (uint256)"]);

async function once(c: ChainRow): Promise<Verdict> {
  const db = getDb();
  const stored = db.prepare("SELECT idx, hash, pons_block FROM trades WHERE chain_n = ? ORDER BY idx").all(c.n) as { idx: number; hash: string; pons_block: number }[];
  const to = Math.max(c.cursor, stored.length ? stored[stored.length - 1].pons_block : 0);
  const trades = await tradesOf(c.curve, BigInt(c.launch_block), BigInt(to));
  const exp = chainOf(c.token, c.curve, trades);
  let firstMismatch: number | null = null;
  for (let i = 0; i < Math.max(stored.length, exp.hashes.length); i++) {
    if (stored[i]?.hash !== exp.hashes[i]) {
      firstMismatch = i + 1;
      break;
    }
  }
  let onChain: string | null = null;
  try {
    const p = createPublicClient({ transport: http(localRpc(c.n)) });
    onChain = (await p.readContract({ address: c.ledger as Hex, abi: ledgerAbi, functionName: "head" })) as string;
  } catch {}
  const head = stored.length ? stored[stored.length - 1].hash : chainOf(c.token, c.curve, []).head;
  const ok = firstMismatch === null && onChain === exp.head;
  return {
    ok,
    checkedAt: Math.floor(Date.now() / 1000),
    ponsTrades: trades.length,
    mirrored: stored.length,
    expectedHead: exp.head,
    storedHead: head,
    ledgerHead: onChain,
    firstMismatch,
    reason: ok ? null : firstMismatch !== null ? `trade ${firstMismatch} differs from Pons` : onChain === null ? "the chain did not answer" : "the ledger head differs from Pons",
  };
}

const inflight = new Map<number, Promise<Verdict>>();
let running = 0;
const MAX_RUNNING = 4; // each check reads a chain's whole history from Pons, so only a few may run at once

/** Cached for 30 seconds. Two visitors asking about the same chain at once share one check, and only a few checks run at a time.
 *  A mismatch is checked a second time first, because the worker may have written between our two reads. */
export async function verifyChain(c: ChainRow): Promise<Verdict> {
  const hit = cache.get(c.n);
  if (hit && Date.now() / 1000 - hit.checkedAt < 30) return hit;
  const same = inflight.get(c.n);
  if (same) return same;
  if (running >= MAX_RUNNING) throw new Error("The check is busy right now. Try again in a moment.");
  running += 1;
  const p = (async () => {
    let v = await once(c);
    if (!v.ok) {
      await new Promise((r) => setTimeout(r, 3000));
      const fresh = getDb().prepare("SELECT * FROM chains WHERE n = ?").get(c.n) as ChainRow;
      v = await once(fresh);
    }
    cache.set(c.n, v);
    return v;
  })().finally(() => {
    running -= 1;
    inflight.delete(c.n);
  });
  inflight.set(c.n, p);
  return p;
}
