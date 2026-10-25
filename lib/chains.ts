// One anvil per token. Each gets its own chain id and port, and keeps its state in a file so a restart does not lose it.
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, defineChain, http, type Hex, type PublicClient, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_ID_BASE, PORT_BASE } from "./consts.ts";
import { chainOf } from "./hash.ts";
import type { Trade } from "./pons.ts";

export const DATA = process.env.SPAWN_DATA ?? path.resolve("data");
export { CHAIN_ID_BASE, PORT_BASE };

// anvil's first dev key. These chains hold no value, and the operator is only the server that writes the record.
const OPERATOR = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
export const operatorAddress = OPERATOR.address;

const artifact = () => JSON.parse(fs.readFileSync(path.resolve("contracts/Ledger.json"), "utf8"));
export const abi = () => artifact().abi;

export type ChainInfo = { n: number; chainId: number; port: number; rpc: string };
export const chainInfo = (n: number): ChainInfo => ({ n, chainId: CHAIN_ID_BASE + n, port: PORT_BASE + n, rpc: `http://127.0.0.1:${PORT_BASE + n}` });

const running = new Map<number, ChildProcess>();

/** Starts (or restarts) the anvil for chain number n and waits until it answers. */
export async function startChain(n: number): Promise<ChainInfo> {
  const info = chainInfo(n);
  if (running.has(n)) return info;
  fs.mkdirSync(path.join(DATA, "chains"), { recursive: true });
  const state = path.join(DATA, "chains", `${info.chainId}.json`);
  const child = spawn("anvil", ["--port", String(info.port), "--chain-id", String(info.chainId), "--state", state, "--state-interval", "20", "--silent", "--host", "127.0.0.1"], { stdio: "ignore" });
  running.set(n, child);
  child.on("exit", () => running.delete(n));
  const c = publicClient(info);
  for (let i = 0; i < 60; i++) {
    try {
      await c.getBlockNumber();
      return info;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`anvil for chain ${info.chainId} did not start`);
}

/** Stops an anvil. SIGINT lets it write its state file. */
export async function stopChain(n: number) {
  const child = running.get(n);
  if (!child) return;
  await new Promise<void>((res) => {
    child.once("exit", () => res());
    child.kill("SIGINT");
  });
}
export const stopAll = () => Promise.all([...running.keys()].map(stopChain));

const chainDef = (i: ChainInfo) => defineChain({ id: i.chainId, name: `shard ${i.chainId}`, nativeCurrency: { name: "Shard", symbol: "SHD", decimals: 18 }, rpcUrls: { default: { http: [i.rpc] } } });
export const publicClient = (i: ChainInfo): PublicClient => createPublicClient({ chain: chainDef(i), transport: http(i.rpc) });
export const walletClient = (i: ChainInfo): WalletClient => createWalletClient({ account: OPERATOR, chain: chainDef(i), transport: http(i.rpc) });

/** Deploys the ledger for one token on its chain and returns the contract address. */
export async function deployLedger(i: ChainInfo, token: string, curve: string, name: string, symbol: string): Promise<Hex> {
  const a = artifact();
  const hash = await walletClient(i).deployContract({ abi: a.abi, bytecode: a.bytecode.object, args: [OPERATOR.address, token, curve, name, symbol], account: OPERATOR, chain: chainDef(i) });
  const rc = await publicClient(i).waitForTransactionReceipt({ hash });
  if (!rc.contractAddress) throw new Error("ledger deploy failed");
  return rc.contractAddress;
}

export type Mirrored = { l2Block: number; l2Tx: Hex; ts: number };

/** Writes trades to the ledger in batches (one transaction, so one block, per batch). Returns where each trade landed, in order. */
export async function mirror(i: ChainInfo, ledger: Hex, trades: Trade[], batch = 150): Promise<Mirrored[]> {
  const w = walletClient(i);
  const p = publicClient(i);
  const out: Mirrored[] = [];
  for (let a = 0; a < trades.length; a += batch) {
    const slice = trades.slice(a, a + batch);
    const part = slice.map((t) => ({ buy: t.buy, wallet: t.wallet as Hex, quote: t.quote, tokens: t.tokens, ponsBlock: BigInt(t.ponsBlock), ponsTx: t.ponsTx as Hex, ponsLogIndex: t.ponsLogIndex }));
    const hash = await w.writeContract({ address: ledger, abi: abi(), functionName: "mirror", args: [part], account: OPERATOR, chain: chainDef(i) });
    const rc = await p.waitForTransactionReceipt({ hash });
    if (rc.status !== "success") throw new Error(`mirror batch ${a} reverted`);
    const blk = await p.getBlock({ blockNumber: rc.blockNumber });
    for (let k = 0; k < slice.length; k++) out.push({ l2Block: Number(rc.blockNumber), l2Tx: hash, ts: Number(blk.timestamp) });
  }
  return out;
}

export async function ledgerHead(i: ChainInfo, ledger: Hex): Promise<{ head: Hex; count: bigint }> {
  const p = publicClient(i);
  const [head, count] = await Promise.all([
    p.readContract({ address: ledger, abi: abi(), functionName: "head" }),
    p.readContract({ address: ledger, abi: abi(), functionName: "count" }),
  ]);
  return { head: head as Hex, count: count as bigint };
}

export const hasCode = async (i: ChainInfo, a: Hex) => ((await publicClient(i).getCode({ address: a })) ?? "0x") !== "0x";
export { chainOf };
