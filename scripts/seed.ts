// Puts recent Pons tokens in the registry so the worker gives them chains (for a demo or a test). Skips the wallet signature: admin only.
//   npm run seed [count]
import { getDb } from "../lib/db.ts";
import { client, decodeLaunch, PONS, scanLogs, SIG, tokenFacts, tradesOf, type Launch } from "../lib/pons.ts";

const want = Number(process.argv[2] ?? 4);
const db = getDb();
const head = await client.getBlockNumber();
const launches: Launch[] = [];
await scanLogs({ address: PONS.factory, topics: [SIG.launched] }, head - 400_000n, head, 2_000_000n, (logs) => launches.push(...logs.map(decodeLaunch)));
launches.sort((a, b) => b.block - a.block);
let added = 0;
for (const l of launches) {
  if (added >= want) break;
  if (db.prepare("SELECT 1 FROM chains WHERE token = ?").get(l.token)) continue;
  const trades = await tradesOf(l.curve, BigInt(l.block), head);
  if (trades.length < 10) continue;
  const f = await tokenFacts(l);
  db.prepare("INSERT INTO chains (token, curve, pair, pair_symbol, pair_decimals, name, symbol, creator, launch_tx, launch_block, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'pending', ?)").run(l.token, l.curve, l.pair, f.pairSymbol, f.pairDecimals, f.name, f.symbol, l.deployer, l.tx, l.block, Math.floor(Date.now() / 1000));
  console.log(`queued ${f.symbol} ${l.token} (${trades.length} trades)`);
  added += 1;
}
console.log(`${added} queued`);
