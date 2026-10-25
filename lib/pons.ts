// Pons v2 on Robinhood Chain (id 4663): what we read from it. Public RPC only; nothing here signs or sends.
import { createPublicClient, http, parseAbi, toEventSelector } from "viem";

export const PONS = {
  rpc: process.env.PONS_RPC ?? "https://rpc.mainnet.chain.robinhood.com",
  factory: (process.env.PONS_FACTORY ?? "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e").toLowerCase(),
};

export const SIG = {
  launched: toEventSelector("TokenLaunched(address,address,address,address,uint256,uint256)"),
  buy: toEventSelector("CurveBuy(address,address,uint256,uint256,uint256,uint256)"),
  sell: toEventSelector("CurveSell(address,address,uint256,uint256,uint256,uint256)"),
};

export const client = createPublicClient({ transport: http(PONS.rpc, { retryCount: 4, retryDelay: 500, timeout: 30_000, batch: { batchSize: 10, wait: 8 } }) });
const hex = (n: bigint | number) => "0x" + n.toString(16);

const addr = (topic: string) => "0x" + topic.slice(26).toLowerCase();
const word = (data: string, i: number) => data.slice(2 + i * 64, 2 + (i + 1) * 64);
const big = (data: string, i: number) => BigInt("0x" + word(data, i));

export type RawLog = { address: string; topics: string[]; data: string; blockNumber: string; logIndex: string; transactionHash: string };

export type Launch = { token: string; curve: string; deployer: string; pair: string; block: number; tx: string };
export const decodeLaunch = (l: RawLog): Launch => ({ token: addr(l.topics[1]), curve: addr(l.topics[2]), deployer: addr(l.topics[3]), pair: "0x" + word(l.data, 0).slice(24).toLowerCase(), block: Number(BigInt(l.blockNumber)), tx: l.transactionHash });

/** One mirrored trade. quote and tokens are the raw amounts from the Pons event. */
export type Trade = { buy: boolean; wallet: string; quote: bigint; tokens: bigint; ponsBlock: number; ponsTx: string; ponsLogIndex: number };
export function decodeTrade(l: RawLog): Trade | null {
  const buy = l.topics[0] === SIG.buy;
  if (!buy && l.topics[0] !== SIG.sell) return null;
  return {
    buy,
    wallet: addr(l.topics[1]),
    quote: buy ? big(l.data, 0) : big(l.data, 1),
    tokens: buy ? big(l.data, 1) : big(l.data, 0),
    ponsBlock: Number(BigInt(l.blockNumber)),
    ponsTx: l.transactionHash,
    ponsLogIndex: Number(BigInt(l.logIndex)),
  };
}

const isLimit = (e: unknown) => /limit|exceed|too many|more than|span/i.test(String((e as { details?: string })?.details ?? (e as Error)?.message ?? ""));

async function retry<T>(fn: () => Promise<T>, tries = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (isLimit(e)) throw e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw last;
}

/** Reads logs over [from, to] in windows of at most `span` blocks, halving any window the RPC refuses (it caps a query at 10,000 logs). */
export async function scanLogs(filter: { address?: string; topics: (string | string[] | null)[] }, from: bigint, to: bigint, span: bigint, onChunk: (logs: RawLog[]) => void) {
  const one = async (a: bigint, b: bigint): Promise<void> => {
    try {
      onChunk((await retry(() => client.request({ method: "eth_getLogs", params: [{ ...filter, fromBlock: hex(a), toBlock: hex(b) }] } as never))) as RawLog[]);
    } catch (e) {
      if (!isLimit(e) || b <= a) throw e;
      const mid = (a + b) / 2n;
      await one(a, mid);
      await one(mid + 1n, b);
    }
  };
  for (let a = from; a <= to; a += span) await one(a, a + span - 1n > to ? to : a + span - 1n);
}

/** Finds a token's launch by its address. Scans the factory's launch events backwards, newest first, in windows. */
export async function findLaunch(token: string, from?: bigint): Promise<Launch | undefined> {
  const padded = "0x" + token.toLowerCase().slice(2).padStart(64, "0");
  const head = await client.getBlockNumber();
  let found: Launch | undefined;
  await scanLogs({ address: PONS.factory, topics: [SIG.launched, padded] }, from ?? 0n, head, 5_000_000n, (logs) => void (found ??= logs[0] && decodeLaunch(logs[0])));
  return found;
}

/** All trades of one token's curve in [from, to], in chain order. */
export async function tradesOf(curve: string, from: bigint, to: bigint): Promise<Trade[]> {
  const out: Trade[] = [];
  // one query per event type: this RPC allows millions of blocks for a single event, but only 100,000 for two at once
  for (const sig of [SIG.buy, SIG.sell]) {
    await scanLogs({ address: curve, topics: [sig] }, from, to, 2_000_000n, (logs) => {
      for (const l of logs) {
        const t = decodeTrade(l);
        if (t) out.push(t);
      }
    });
  }
  return out.sort((a, b) => a.ponsBlock - b.ponsBlock || a.ponsLogIndex - b.ponsLogIndex);
}

const erc20 = parseAbi(["function name() view returns (string)", "function symbol() view returns (string)", "function decimals() view returns (uint8)"]);
const read = <T>(address: string, functionName: "name" | "symbol" | "decimals", fallback: T) =>
  client.readContract({ address: address as `0x${string}`, abi: erc20, functionName }).then((v) => v as T).catch(() => fallback);

/** Name and symbol of a token, and what its trades are quoted in. */
export async function tokenFacts(l: Launch) {
  const native = /^0x0{40}$/.test(l.pair); // the zero address as pair token means the chain's own ETH
  const [name, symbol, pairSymbol, pairDecimals] = await Promise.all([
    read(l.token, "name", "unnamed"),
    read(l.token, "symbol", "?"),
    native ? "ETH" : read(l.pair, "symbol", "?"),
    native ? 18 : read(l.pair, "decimals", 18),
  ]);
  return { name: String(name).slice(0, 64), symbol: String(symbol).slice(0, 24), pairSymbol: String(pairSymbol).slice(0, 24), pairDecimals: Number(pairDecimals) };
}
