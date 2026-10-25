// What the launch page's wallet card shows: the wallet's balance on Robinhood Chain, whether Pons lets it launch, the launch fee,
// and the chains this wallet has already spawned. All of it is public data; nothing here needs a signature.
import { capReason } from "@/lib/caps.ts";
import { getDb } from "@/lib/db.ts";
import { chainIdOf } from "@/lib/consts.ts";
import { launchGate } from "@/lib/launch.ts";
import { ipOf, limited } from "@/lib/limit.ts";
import { client } from "@/lib/pons.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (limited("wallet:" + ipOf(req), 40, 60_000)) return Response.json({ error: "Too many tries." }, { status: 429 });
  const a = new URL(req.url).searchParams.get("address")?.toLowerCase() ?? "";
  if (!/^0x[0-9a-f]{40}$/.test(a)) return Response.json({ error: "Not an address." }, { status: 400 });
  try {
    const [balance, gate] = await Promise.all([client.getBalance({ address: a as `0x${string}` }), launchGate(a as `0x${string}`)]);
    const chains = (getDb().prepare("SELECT n, symbol, name, count FROM chains WHERE creator = ? AND status = 'live' ORDER BY n DESC LIMIT 20").all(a) as { n: number; symbol: string; name: string; count: number }[]).map((c) => ({ chainId: chainIdOf(c.n), symbol: c.symbol, name: c.name, count: c.count }));
    return Response.json({ balanceWei: balance.toString(), launchFeeWei: gate.launchFeeWei.toString(), canLaunch: gate.canLaunch, capReason: capReason(a), chains });
  } catch {
    return Response.json({ error: "Could not read the chain. Try again in a moment." }, { status: 502 });
  }
}
