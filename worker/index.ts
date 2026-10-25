// The worker: owns the anvil chains, gives new tokens a chain, and keeps mirroring Pons trades onto them.
//   npm run worker
import fs from "node:fs";
import path from "node:path";
import type { Hex } from "viem";
import { CHAIN_ID_BASE, chainInfo, DATA, deployLedger, hasCode, ledgerHead, mirror, startChain, stopAll, stopChain } from "../lib/chains.ts";
import { type ChainRow, getDb, setMeta } from "../lib/db.ts";
import { genesis, link } from "../lib/hash.ts";
import { client, decodeTrade, scanLogs, SIG, tradesOf, type RawLog, type Trade } from "../lib/pons.ts";

const db = getDb();
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const row = (n: number) => db.prepare("SELECT * FROM chains WHERE n = ?").get(n) as ChainRow;
const rows = (status: string) => db.prepare("SELECT * FROM chains WHERE status = ? ORDER BY n").all(status) as ChainRow[];
const tx = (fn: () => void) => {
  db.exec("BEGIN");
  try {
    fn();
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
};

/** Writes trades to the chain's ledger, records them with their hashes, and checks the on-chain head equals ours. */
async function mirrorInto(c: ChainRow, trades: Trade[]) {
  if (!trades.length) return;
  const info = chainInfo(c.n);
  const placed = await mirror(info, c.ledger as Hex, trades);
  let h = (c.head as Hex | null) ?? genesis(c.token, c.curve);
  let idx = c.count;
  const ins = db.prepare("INSERT INTO trades (chain_n, idx, buy, wallet, quote, tokens, pons_block, pons_tx, pons_log, hash, l2_block, l2_tx, mirrored_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  tx(() => {
    trades.forEach((t, k) => {
      h = link(h, t);
      idx += 1;
      ins.run(c.n, idx, t.buy ? 1 : 0, t.wallet, t.quote.toString(), t.tokens.toString(), t.ponsBlock, t.ponsTx, t.ponsLogIndex, h, placed[k].l2Block, placed[k].l2Tx, placed[k].ts);
    });
    db.prepare("UPDATE chains SET count = ?, head = ? WHERE n = ?").run(idx, h, c.n);
  });
  const on = await ledgerHead(info, c.ledger as Hex);
  if (on.head !== h || on.count !== BigInt(idx)) throw new Error(`chain ${info.chainId}: ledger head does not match the recomputed hash`);
}

/** Starts the chain from nothing: any old state file is removed, so a rebuild always replays from the Pons logs. */
async function freshAnvil(n: number) {
  await stopChain(n);
  fs.rmSync(path.join(DATA, "chains", `${CHAIN_ID_BASE + n}.json`), { force: true });
  return startChain(n);
}

async function spawnChain(c: ChainRow) {
  log(`chain ${CHAIN_ID_BASE + c.n}: starting for ${c.symbol} ${c.token}`);
  const info = await freshAnvil(c.n);
  const ledger = await deployLedger(info, c.token, c.curve, c.name, c.symbol);
  const head = Number(await client.getBlockNumber());
  tx(() => {
    db.prepare("DELETE FROM trades WHERE chain_n = ?").run(c.n);
    db.prepare("UPDATE chains SET chain_id = ?, ledger = ?, count = 0, head = NULL, cursor = ?, error = NULL WHERE n = ?").run(info.chainId, ledger, c.launch_block - 1, c.n);
  });
  const trades = await tradesOf(c.curve, BigInt(c.launch_block), BigInt(head));
  await mirrorInto(row(c.n), trades);
  db.prepare("UPDATE chains SET status = 'live', cursor = ? WHERE n = ?").run(head, c.n);
  log(`chain ${info.chainId}: live, ${trades.length} trades mirrored`);
}

/** The ledger on disk must match the database. If it does not (the worker was killed mid-write), the chain is rebuilt from Pons. */
async function resume(c: ChainRow) {
  const info = await startChain(c.n);
  try {
    if (c.ledger && (await hasCode(info, c.ledger as Hex))) {
      const on = await ledgerHead(info, c.ledger as Hex);
      if (on.count === BigInt(c.count) && (on.count === 0n || on.head === c.head)) return;
    }
  } catch {}
  log(`chain ${info.chainId}: ledger and database disagree, rebuilding from Pons`);
  db.prepare("UPDATE chains SET status = 'pending' WHERE n = ?").run(c.n);
}

async function follow() {
  const live = rows("live");
  if (!live.length) return;
  const head = Number(await client.getBlockNumber());
  setMeta("pons_head", head);
  const lo = Math.min(...live.map((c) => c.cursor)) + 1;
  if (lo > head) return;
  const byCurve = new Map(live.map((c) => [c.curve, c]));
  const got = new Map<number, Trade[]>();
  const onLogs = (logs: RawLog[]) => {
    for (const l of logs) {
      const c = byCurve.get(l.address.toLowerCase());
      const t = c && decodeTrade(l);
      if (c && t && t.ponsBlock > c.cursor) got.set(c.n, [...(got.get(c.n) ?? []), t]);
    }
  };
  await scanLogs({ address: live.map((c) => c.curve) as unknown as string, topics: [[SIG.buy, SIG.sell]] }, BigInt(lo), BigInt(head), 100_000n, onLogs);
  for (const c of live) {
    try {
      const trades = (got.get(c.n) ?? []).sort((a, b) => a.ponsBlock - b.ponsBlock || a.ponsLogIndex - b.ponsLogIndex);
      await mirrorInto(c, trades);
      db.prepare("UPDATE chains SET cursor = ? WHERE n = ?").run(head, c.n);
      if (trades.length) log(`chain ${CHAIN_ID_BASE + c.n} ${c.symbol}: +${trades.length} trades (${row(c.n).count} total)`);
    } catch (e) {
      log(`chain ${CHAIN_ID_BASE + c.n}: ${(e as Error).message}`);
    }
  }
}

async function tick() {
  for (const c of rows("pending")) {
    try {
      await spawnChain(c);
    } catch (e) {
      const msg = String((e as Error).message ?? e).slice(0, 300);
      log(`chain ${CHAIN_ID_BASE + c.n}: failed, ${msg}`);
      db.prepare("UPDATE chains SET status = 'error', error = ?, error_at = ? WHERE n = ?").run(msg, Math.floor(Date.now() / 1000), c.n);
    }
  }
  // a failed chain is tried again after a minute
  db.prepare("UPDATE chains SET status = 'pending' WHERE status = 'error' AND error_at < ?").run(Math.floor(Date.now() / 1000) - 60);
  await follow();
  setMeta("worker_tick", Math.floor(Date.now() / 1000));
}

for (const c of rows("live")) await resume(c);
log(`worker up, ${rows("live").length} live chains`);
let stop = false;
for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, async () => {
    stop = true;
    log("stopping, saving chain state");
    await stopAll();
    process.exit(0);
  });
while (!stop) {
  try {
    await tick();
  } catch (e) {
    log("tick failed:", (e as Error).message);
  }
  await new Promise((r) => setTimeout(r, 2500));
}
