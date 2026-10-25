// Proves the launch flow on a local fork of Robinhood Chain: no real money, nothing sent to the real chain.
//   npx tsx scripts/launch-test.ts
import { spawn } from "node:child_process";
import { createWalletClient, createPublicClient, http, parseEther, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const REAL = process.env.PONS_RPC ?? "https://rpc.mainnet.chain.robinhood.com";
const PORT = 8547 + Math.floor(Math.random() * 400); // a random port, so a leftover fork from an earlier crashed run can never be mistaken for this one
let fork = spawn("anvil", ["--fork-url", REAL, "--port", String(PORT), "--silent", "--host", "127.0.0.1"], { stdio: "ignore" });
const RPC = `http://127.0.0.1:${PORT}`;
process.env.PONS_RPC = RPC; // set before the library is loaded, so it reads the fork
const { prepareLaunch, inspectLaunchTx, SALT_TAG } = await import("../lib/launch.ts");

process.on("exit", () => fork.kill("SIGTERM"));
const pub = createPublicClient({ transport: http(RPC) });
for (let i = 0; i < 80; i++) {
  try {
    await pub.getBlockNumber();
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 250));
  }
}
const account = privateKeyToAccount(generatePrivateKey()); // a fresh key: the anvil default keys have sweeper bots on the real chain
// the public RPC prunes old state: a fork can start on a block it can no longer serve, so a failed first state read restarts the fork on a newer block
for (let attempt = 1; ; attempt++) {
  try {
    await pub.request({ method: "anvil_setBalance", params: [account.address, "0x" + parseEther("10").toString(16)] } as never);
    break;
  } catch (e) {
    if (attempt >= 6) throw e;
    console.log(`fork state not available (try ${attempt}), restarting the fork`);
    fork.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 1500));
    fork = spawn("anvil", ["--fork-url", REAL, "--port", String(PORT), "--silent", "--host", "127.0.0.1"], { stdio: "ignore" });
    for (let i = 0; i < 80; i++) {
      try {
        await pub.getBlockNumber();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }
}
const wallet = createWalletClient({ account, transport: http(RPC) });
let failed = false;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed = true;
};

for (const buyEth of ["", "0.01"]) {
  const label = buyEth ? `with a ${buyEth} ETH first buy` : "without a first buy";
  try {
    const p = await prepareLaunch({ from: account.address, name: "Spawn Test", symbol: "SHRD", description: "fork test", buyEth });
    check(p.salt.startsWith(SALT_TAG), `${label}: salt carries the tag`);
    const hash = await wallet.sendTransaction({ to: p.to, data: p.data, value: BigInt(p.value), chain: null });
    const rc = await pub.waitForTransactionReceipt({ hash });
    check(rc.status === "success", `${label}: the launch transaction succeeded (${hash.slice(0, 10)}…)`);
    const l = await inspectLaunchTx(hash as Hex);
    check(!!l && l.deployer === account.address.toLowerCase(), `${label}: the receipt names the wallet as deployer`);
    check(!!l?.ours, `${label}: the launch is recognised as made through the site`);
    console.log(`      token ${l?.token}, curve ${l?.curve}${p.tokensOut ? `, first buy returned ${p.tokensOut}` : ""}`);
  } catch (e) {
    check(false, `${label}: ${(e as Error).message.split("\n")[0]}`);
  }
}
fork.kill("SIGTERM");
process.exit(failed ? 1 : 0);
