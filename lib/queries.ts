import { chainIdOf, nOf } from "./consts.ts";
import { type ChainRow, chainByN, getDb, getMeta, type TradeRow } from "./db.ts";
import { units } from "./format.ts";
import { genesis } from "./hash.ts";

export const chainFor = (chainId: number) => (Number.isInteger(chainId) ? chainByN(nOf(chainId)) : undefined);
export const idOf = (c: ChainRow) => chainIdOf(c.n);

export function stats() {
  const db = getDb();
  const live = (db.prepare("SELECT COUNT(*) AS c FROM chains WHERE status = 'live'").get() as { c: number }).c;
  const starting = (db.prepare("SELECT COUNT(*) AS c FROM chains WHERE status != 'live'").get() as { c: number }).c;
  const trades = (db.prepare("SELECT COALESCE(SUM(count),0) AS c FROM chains").get() as { c: number }).c;
  const tick = Number(getMeta("worker_tick") ?? 0);
  return { live, starting, trades, workerAge: tick ? Math.floor(Date.now() / 1000) - tick : null };
}

export type ChainCard = ChainRow & { chainId: number; lastAt: number | null };
export function chains(limit = 60, offset = 0, q = ""): ChainCard[] {
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const rows = getDb()
    .prepare(
      `SELECT c.*, (SELECT MAX(mirrored_at) FROM trades t WHERE t.chain_n = c.n) AS lastAt FROM chains c WHERE c.status IN ('live','pending') AND (c.symbol LIKE ? OR c.name LIKE ? OR c.token LIKE ?) ORDER BY c.n DESC LIMIT ? OFFSET ?`,
    )
    .all(like, like, like, limit, offset) as (ChainRow & { lastAt: number | null })[];
  return rows.map((r) => ({ ...r, chainId: chainIdOf(r.n) }));
}

export function tradesPage(n: number, page: number, per = 40) {
  return getDb().prepare("SELECT * FROM trades WHERE chain_n = ? ORDER BY idx DESC LIMIT ? OFFSET ?").all(n, per, page * per) as TradeRow[];
}

export type BlockRow = { l2_block: number; l2_tx: string; mirrored_at: number; n: number; first: number; last: number };
export function blocksPage(n: number, page: number, per = 30) {
  return getDb()
    .prepare("SELECT l2_block, l2_tx, MAX(mirrored_at) AS mirrored_at, COUNT(*) AS n, MIN(idx) AS first, MAX(idx) AS last FROM trades WHERE chain_n = ? GROUP BY l2_block ORDER BY l2_block DESC LIMIT ? OFFSET ?")
    .all(n, per, page * per) as BlockRow[];
}
export const blockCount = (n: number) => (getDb().prepare("SELECT COUNT(DISTINCT l2_block) AS c FROM trades WHERE chain_n = ?").get(n) as { c: number }).c;
export const lastBlock = (n: number) => (getDb().prepare("SELECT MAX(l2_block) AS b FROM trades WHERE chain_n = ?").get(n) as { b: number | null }).b;

export function feedInitial() {
  const rows = getDb()
    .prepare("SELECT t.chain_n, t.idx, t.buy, t.wallet, t.quote, t.tokens, t.mirrored_at, c.symbol, c.pair_symbol, c.pair_decimals FROM trades t JOIN chains c ON c.n = t.chain_n ORDER BY t.mirrored_at DESC, t.chain_n, t.idx DESC LIMIT 12")
    .all() as { chain_n: number; idx: number; buy: number; wallet: string; quote: string; tokens: string; mirrored_at: number; symbol: string; pair_symbol: string; pair_decimals: number }[];
  return rows.map((r) => ({ chainId: chainIdOf(r.chain_n), idx: r.idx, buy: !!r.buy, wallet: r.wallet, symbol: r.symbol, tokens: units(r.tokens), quote: units(r.quote, r.pair_decimals), pair: r.pair_symbol, at: r.mirrored_at }));
}

/** The hash a chain is drawn from: its running head, or the starting hash before its first trade. */
export const hashOf = (c: ChainRow) => c.head ?? genesis(c.token, c.curve);

export type ChainListRow = { n: number; chainId: number; symbol: string; name: string; count: number; lastAt: number | null; hash: string; live: boolean };
export function chainRows(limit = 60, offset = 0, q = ""): ChainListRow[] {
  return chains(limit, offset, q).map((c) => ({ n: c.n, chainId: c.chainId, symbol: c.symbol, name: c.name, count: c.count, lastAt: c.lastAt, hash: hashOf(c), live: c.status === "live" }));
}

export type HeroState = { idx: number; hash: string; buy: boolean; tokens: string; quote: string; at: number };
export type HeroData = { chainId: number; symbol: string; name: string; count: number; pair: string; head: string; genesis: string; states: HeroState[] };

/** The chain the home page draws: the live one that traded most recently, with its last trades (oldest first). */
export function featured(window = 24): HeroData | null {
  const db = getDb();
  const c = db
    .prepare("SELECT c.* FROM chains c WHERE c.status = 'live' AND c.count > 0 ORDER BY (SELECT MAX(mirrored_at) FROM trades t WHERE t.chain_n = c.n) DESC LIMIT 1")
    .get() as ChainRow | undefined;
  if (!c || !c.head) return null;
  const rows = (db.prepare("SELECT idx, hash, buy, tokens, quote, mirrored_at FROM trades WHERE chain_n = ? ORDER BY idx DESC LIMIT ?").all(c.n, window) as { idx: number; hash: string; buy: number; tokens: string; quote: string; mirrored_at: number }[]).reverse();
  return {
    chainId: chainIdOf(c.n),
    symbol: c.symbol,
    name: c.name,
    count: c.count,
    pair: c.pair_symbol,
    head: c.head,
    genesis: genesis(c.token, c.curve),
    states: rows.map((r) => ({ idx: r.idx, hash: r.hash, buy: !!r.buy, tokens: units(r.tokens), quote: units(r.quote, c.pair_decimals), at: r.mirrored_at })),
  };
}
