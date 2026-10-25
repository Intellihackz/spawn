import { getDb } from "@/lib/db.ts";
import { chainIdOf } from "@/lib/consts.ts";
import { units } from "@/lib/format.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = getDb()
    .prepare(
      "SELECT t.chain_n, t.idx, t.buy, t.wallet, t.quote, t.tokens, t.mirrored_at, c.symbol, c.pair_symbol, c.pair_decimals FROM trades t JOIN chains c ON c.n = t.chain_n ORDER BY t.mirrored_at DESC, t.chain_n, t.idx DESC LIMIT 24",
    )
    .all() as { chain_n: number; idx: number; buy: number; wallet: string; quote: string; tokens: string; mirrored_at: number; symbol: string; pair_symbol: string; pair_decimals: number }[];
  return Response.json({
    trades: rows.map((r) => ({ chainId: chainIdOf(r.chain_n), idx: r.idx, buy: !!r.buy, wallet: r.wallet, symbol: r.symbol, tokens: units(r.tokens), quote: units(r.quote, r.pair_decimals), pair: r.pair_symbol, at: r.mirrored_at })),
  });
}
