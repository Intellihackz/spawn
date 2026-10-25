// The whole new-token flow on a local fork of Robinhood Chain (no real money): launch through the site, register, the worker starts a chain,
// live trades get mirrored, the check passes, and the register route refuses what it should.
//   npx tsx scripts/flow-test.ts
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const REAL = "https://rpc.mainnet.chain.robinhood.com";
const PORT = 8548;
const RPC = `http://127.0.0.1:${PORT}`;
const data = fs.mkdtempSync(path.join(os.tmpdir(), "spawn-flow-"));
process.env.PONS_RPC = RPC;
process.env.SPAWN_DATA = data;
process.env.SPAWN_PORT_BASE = "19000";

const fork = spawn("anvil", ["--fork-url", REAL, "--port", String(PORT), "--silent", "--host", "127.0.0.1"], { stdio: "ignore" });
const pub = createPublicClient({ transport: http(RPC) });
for (let i = 0; i < 80; i++) {
  try {
    await pub.getBlockNumber();
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 250));
  }
}
let failed = false;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed = true;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { prepareLaunch } = await import("../lib/launch.ts");
const reg = await import("../app/api/register/route.ts");
const { getDb } = await import("../lib/db.ts");
const { verifyChain } = await import("../lib/verify.ts");

const account = privateKeyToAccount(generatePrivateKey());
const stranger = privateKeyToAccount(generatePrivateKey());
await pub.request({ method: "anvil_setBalance", params: [account.address, "0x" + parseEther("10").toString(16)] } as never);
const wallet = createWalletClient({ account, transport: http(RPC) });
const post = (body: unknown) => reg.POST(new Request("http://x/api/register", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "t" + Math.random() } }));

// 1. launch through the site, with a first buy
const p = await prepareLaunch({ from: account.address, name: "Flow Test", symbol: "FLOW", buyEth: "0.01" });
const launchHash = await wallet.sendTransaction({ to: p.to, data: p.data, value: BigInt(p.value), chain: null });
await pub.waitForTransactionReceipt({ hash: launchHash });
check(true, "launched through the site");

// 2. the register route
let r = await post({ txHash: "0x" + "12".repeat(32) });
check(r.status === 404, "a transaction that is not a launch is refused (404)");
r = await post({ message: "hello", signature: "0x00" });
check(r.status === 400, "a message that is not a claim is refused (400)");
r = await post({ txHash: launchHash });
const j = (await r.json()) as { chainId: number; already: boolean };
check(r.status === 200 && j.chainId === 7770001 && !j.already, `registered by launch hash, chain ${j.chainId}`);
r = await post({ txHash: launchHash });
check(((await r.json()) as { already: boolean }).already === true, "registering the same token again returns the same chain");

// a second token, claimed by signature: first by a stranger (refused), then by the launcher
const p2 = await prepareLaunch({ from: account.address, name: "Claim Test", symbol: "CLM" });
const h2 = await wallet.sendTransaction({ to: p2.to, data: p2.data, value: BigInt(p2.value), chain: null });
const rc2 = await pub.waitForTransactionReceipt({ hash: h2 });
const token2 = ("0x" + rc2.logs.find((l) => l.topics.length === 4)!.topics[1]!.slice(26)).toLowerCase();
const msg = (t: string, at = Math.floor(Date.now() / 1000)) => `Spawn\nGive token ${t} its own chain.\nIssued ${at}`;
let m = msg(token2);
r = await post({ message: m, signature: await stranger.signMessage({ message: m }) });
check(r.status === 403, "a stranger cannot claim someone else's token (403)");
m = msg(token2, Math.floor(Date.now() / 1000) - 3600);
r = await post({ message: m, signature: await account.signMessage({ message: m }) });
check(r.status === 400, "an old signature is refused (400)");
m = msg(token2);
r = await post({ message: m, signature: await account.signMessage({ message: m }) });
check(r.status === 200 && ((await r.json()) as { chainId: number }).chainId === 7770002, "the launcher can claim it by signature");

// 3. the worker starts both chains (it follows the fork)
const worker = spawn("npx", ["tsx", "worker/index.ts"], { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] });
let wlog = "";
worker.stdout.on("data", (d) => (wlog += d));
worker.stderr.on("data", (d) => (wlog += d));
const db = getDb();
const status = (n: number) => db.prepare("SELECT status, count FROM chains WHERE n = ?").get(n) as { status: string; count: number };
for (let i = 0; i < 60 && !(status(1).status === "live" && status(2).status === "live"); i++) await sleep(1000);
check(status(1).status === "live" && status(2).status === "live", "the worker started both chains");
check(status(1).count === 1, `the launch's own first buy was mirrored (${status(1).count} trade)`);

// 4. live trades: buy twice more on the curve, the worker should mirror them
const c1 = db.prepare("SELECT curve FROM chains WHERE n = 1").get() as { curve: Hex };
const curveAbi = parseAbi(["function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256)"]);
for (const eth of ["0.005", "0.007"]) {
  const h = await wallet.writeContract({ address: c1.curve, abi: curveAbi, functionName: "buy", args: [parseEther(eth), 0n, account.address], value: parseEther(eth), chain: null });
  await pub.waitForTransactionReceipt({ hash: h });
}
for (let i = 0; i < 30 && status(1).count < 3; i++) await sleep(1000);
check(status(1).count === 3, `live buys were mirrored (${status(1).count} trades)`);

// 5. the independent check
const row = db.prepare("SELECT * FROM chains WHERE n = 1").get() as never;
const v = await verifyChain(row);
check(v.ok && v.mirrored === 3, `the mirror matches Pons (${v.mirrored} trades, ledger head equals the rebuilt hash)`);

worker.kill("SIGTERM");
await sleep(2500);
fork.kill("SIGTERM");
if (failed) console.log("\nworker log:\n" + wlog);
process.exit(failed ? 1 : 0);
