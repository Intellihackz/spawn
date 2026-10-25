// A read-only window onto a chain's RPC, so a wallet can add the network. Anything that writes is refused: only the worker writes to these chains.
import { chainByN } from "@/lib/db.ts";
import { localRpc, nOf } from "@/lib/consts.ts";
import { ipOf, limited } from "@/lib/limit.ts";

export const dynamic = "force-dynamic";

const READ = new Set([
  "eth_chainId", "net_version", "web3_clientVersion", "eth_blockNumber", "eth_getBlockByNumber", "eth_getBlockByHash", "eth_getTransactionByHash", "eth_getTransactionReceipt",
  "eth_getLogs", "eth_call", "eth_getBalance", "eth_getCode", "eth_getStorageAt", "eth_gasPrice", "eth_estimateGas", "eth_getTransactionCount", "eth_maxPriorityFeePerGas",
  "eth_feeHistory", "eth_getBlockTransactionCountByNumber", "eth_getBlockTransactionCountByHash", "eth_syncing", "eth_accounts",
]);
const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };
const refuse = (id: unknown, method: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code: -32601, message: `${method} is not available: this chain is a mirror, and only the Spawn worker writes to it` } });

export const OPTIONS = () => new Response(null, { status: 204, headers: cors });

export async function POST(req: Request, { params }: { params: Promise<{ chainId: string }> }) {
  if (limited("rpc:" + ipOf(req), 300, 60_000)) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32005, message: "Too many requests. Slow down." } }, { status: 429, headers: cors });
  const c = chainByN(nOf(Number((await params).chainId)));
  if (!c || c.status !== "live") return Response.json({ error: "No live chain with that id." }, { status: 404, headers: cors });
  const body = (await req.json().catch(() => null)) as unknown;
  const calls = Array.isArray(body) ? body : [body];
  if (!body || calls.length > 20 || calls.some((x) => typeof (x as { method?: unknown })?.method !== "string")) return Response.json({ error: "Bad JSON-RPC request." }, { status: 400, headers: cors });
  const allowed = calls.filter((x) => READ.has((x as { method: string }).method));
  const upstream = allowed.length
    ? ((await fetch(localRpc(c.n), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(allowed) }).then((r) => r.json()).catch(() => null)) as unknown)
    : [];
  if (allowed.length && !upstream) return Response.json({ error: "The chain did not answer." }, { status: 502, headers: cors });
  const answers = new Map((Array.isArray(upstream) ? upstream : [upstream]).filter(Boolean).map((a) => [(a as { id: unknown }).id, a]));
  const out = calls.map((x) => {
    const call = x as { id: unknown; method: string };
    return READ.has(call.method) ? (answers.get(call.id) ?? refuse(call.id, call.method)) : refuse(call.id, call.method);
  });
  return Response.json(Array.isArray(body) ? out : out[0], { headers: cors });
}
