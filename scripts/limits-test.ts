// Tests the capacity caps, the client-address logic, the health route and the rate limits, against a throwaway database.
//   npx tsx scripts/limits-test.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.SPAWN_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "spawn-limits-"));
process.env.SPAWN_MAX_CHAINS = "3";
process.env.SPAWN_MAX_PER_WALLET = "1";
let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed++;
};

const { getDb } = await import("../lib/db.ts");
const { capReason } = await import("../lib/caps.ts");
const { ipFromHeaders, limited } = await import("../lib/limit.ts");
const launch = await import("../app/api/launch/route.ts");
const wallet = await import("../app/api/wallet/route.ts");
const health = await import("../app/api/health/route.ts");
const rpc = await import("../app/rpc/[chainId]/route.ts");

const db = getDb();
const insert = (i: number, creator: string) =>
  db
    .prepare("INSERT INTO chains (token, curve, pair, pair_symbol, pair_decimals, name, symbol, creator, launch_tx, launch_block, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'live', 0)")
    .run(`0x${i}`.padEnd(42, "0"), `0xc${i}`.padEnd(42, "0"), "0x" + "0".repeat(40), "ETH", 18, "T" + i, "T" + i, creator, "0x" + "0".repeat(64), 1);
const A = "0x" + "a".repeat(40);
const B = "0x" + "b".repeat(40);
const C = "0x" + "c".repeat(40);
const D = "0x" + "d".repeat(40);

// caps
check(capReason(A) === null, "an empty server lets a wallet launch");
insert(1, A);
check(/already has 1 chains/.test(capReason(A) ?? ""), "a wallet at its per-wallet limit is refused (limit 1)");
check(capReason(B) === null, "another wallet is still fine");
insert(2, B);

// the launch route refuses before any Pons call, with a clear message (409)
const post = (from: string, ip = "9.9.9.9") => launch.POST(new Request("http://x/api/launch", { method: "POST", body: JSON.stringify({ from, name: "X", symbol: "X" }), headers: { "x-forwarded-for": ip } }));
let r = await post(A);
let j = (await r.json()) as { error: string };
check(r.status === 409 && /per wallet/.test(j.error), "POST /api/launch answers 409 for a wallet at its limit");

// the wallet route tells the page, so the button can say so
const w = await wallet.GET(new Request(`http://x/api/wallet?address=${A}`, { headers: { "x-forwarded-for": "8.8.8.8" } }));
const wj = (await w.json()) as { capReason?: string | null; error?: string };
check(w.status === 200 ? /per wallet/.test(wj.capReason ?? "") : true, w.status === 200 ? "GET /api/wallet reports the reason in capReason" : `GET /api/wallet could not reach Pons here (${w.status}), skipped`);

insert(3, C);
check(/full right now/.test(capReason(D) ?? ""), "when the server is at its chain cap, a new wallet is refused (cap 3)");
let rf = await post(D);
let jf = (await rf.json()) as { error: string };
check(rf.status === 409 && /full right now/.test(jf.error), `POST /api/launch answers 409 "${jf.error.slice(0, 40)}…" when full`);

// client address: count from the end, so a client cannot choose it
check(ipFromHeaders(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" })) === "1.2.3.4", "with one trusted proxy the address is the last entry (a spoofed first entry is ignored)");
process.env.SPAWN_TRUSTED_HOPS = "2";
check(ipFromHeaders(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4, 10.0.0.1" })) === "1.2.3.4", "with two trusted proxies it is the second from the end");
process.env.SPAWN_TRUSTED_HOPS = "1";
check(ipFromHeaders(new Headers()) === "local", "no header gives 'local'");

// rate limiter
let blocked = 0;
for (let i = 0; i < 12; i++) if (limited("t:1", 10, 60_000)) blocked++;
check(blocked === 2, "the limiter lets 10 through and blocks the next 2");

// health
const h = await health.GET();
const hj = (await h.json()) as { ok: boolean; liveChains: number; maxChains: number; worker: string };
check(h.status === 200 && hj.ok && hj.liveChains === 3 && hj.maxChains === 3 && hj.worker === "starting", `GET /api/health ok (${JSON.stringify(hj)})`);

// the rpc proxy is rate limited (301st request in a minute from one address)
const call = () => rpc.POST(new Request("http://x/rpc/1", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId" }), headers: { "x-forwarded-for": "5.5.5.5" } }), { params: Promise.resolve({ chainId: "7770001" }) });
let last = 0;
for (let i = 0; i < 302; i++) last = (await call()).status;
check(last === 429, "the RPC proxy answers 429 after 300 requests a minute from one address");

process.exit(failed ? 1 : 0);
