// Takes a real Pons token (the one you pass, or a recent one with enough trades), gives it a chain, mirrors its trades,
// and checks that the hash on the chain equals the hash recomputed from the Pons logs.
//   npm run e2e [tokenAddress]
import { parseAbi, type Hex } from "viem";
import { chainInfo, deployLedger, ledgerHead, mirror, startChain, stopAll } from "../lib/chains.ts";
import { chainOf } from "../lib/hash.ts";
import { client, decodeLaunch, findLaunch, PONS, scanLogs, SIG, tradesOf, type Launch } from "../lib/pons.ts";

const erc20 = parseAbi(["function name() view returns (string)", "function symbol() view returns (string)"]);
const arg = process.argv[2]?.toLowerCase();

async function pick(): Promise<Launch> {
  if (arg) {
    const l = await findLaunch(arg);
    if (!l) throw new Error(`no Pons launch found for ${arg}`);
    return l;
  }
  const head = await client.getBlockNumber();
  const launches: Launch[] = [];
  await scanLogs({ address: PONS.factory, topics: [SIG.launched] }, head - 600_000n, head, 2_000_000n, (logs) => launches.push(...logs.map(decodeLaunch)));
  launches.sort((a, b) => b.block - a.block);
  for (const l of launches.slice(0, 40)) {
    const t = await tradesOf(l.curve, BigInt(l.block), head);
    if (t.length >= 25) return l;
  }
  throw new Error("no recent token with enough trades");
}

const launch = await pick();
const head = await client.getBlockNumber();
const [name, symbol] = await Promise.all([
  client.readContract({ address: launch.token as Hex, abi: erc20, functionName: "name" }).catch(() => "unnamed"),
  client.readContract({ address: launch.token as Hex, abi: erc20, functionName: "symbol" }).catch(() => "?"),
]);
console.log(`token ${name} (${symbol}) ${launch.token}, launched in block ${launch.block}`);

const trades = await tradesOf(launch.curve, BigInt(launch.block), head);
console.log(`${trades.length} trades on the Pons curve`);
const expected = chainOf(launch.token, launch.curve, trades);

const info = chainInfo(1);
await startChain(1);
const t0 = Date.now();
const ledger = await deployLedger(info, launch.token, launch.curve, String(name), String(symbol));
console.log(`chain ${info.chainId} up, ledger ${ledger}`);
await mirror(info, ledger, trades);
const got = await ledgerHead(info, ledger);
console.log(`mirrored in ${((Date.now() - t0) / 1000).toFixed(1)}s, on-chain count ${got.count}`);
console.log(`on chain  ${got.head}\nrecomputed ${expected.head}`);
const ok = got.head === expected.head && got.count === BigInt(trades.length);
console.log(ok ? "MATCH: the mirror is honest" : "MISMATCH");
await stopAll();
process.exit(ok ? 0 : 1);
