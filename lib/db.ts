// One SQLite file shared by the worker (writes) and the Next.js pages (reads). WAL mode lets both use it at once.
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

export const DATA = process.env.SPAWN_DATA ?? path.resolve("data");

export type ChainRow = {
  n: number; token: string; curve: string; pair: string; pair_symbol: string; pair_decimals: number; name: string; symbol: string; creator: string; launch_tx: string; launch_block: number;
  chain_id: number; ledger: string | null; status: "pending" | "live" | "error"; error: string | null; cursor: number; count: number; head: string | null; created_at: number; error_at: number | null;
};
export type TradeRow = {
  chain_n: number; idx: number; buy: number; wallet: string; quote: string; tokens: string; pons_block: number; pons_tx: string; pons_log: number; hash: string; l2_block: number; l2_tx: string; mirrored_at: number;
};

let db: DatabaseSync | undefined;
export function getDb(): DatabaseSync {
  if (db) return db;
  // process.getBuiltinModule keeps the bundler from trying to resolve node:sqlite
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
  fs.mkdirSync(DATA, { recursive: true });
  db = new DatabaseSync(path.join(DATA, "spawn.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS chains (
      n INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE, curve TEXT NOT NULL, pair TEXT NOT NULL, pair_symbol TEXT NOT NULL, pair_decimals INTEGER NOT NULL, name TEXT NOT NULL, symbol TEXT NOT NULL, creator TEXT NOT NULL,
      launch_tx TEXT NOT NULL, launch_block INTEGER NOT NULL,
      chain_id INTEGER UNIQUE, ledger TEXT, status TEXT NOT NULL DEFAULT 'pending', error TEXT, error_at INTEGER,
      cursor INTEGER NOT NULL DEFAULT 0, count INTEGER NOT NULL DEFAULT 0, head TEXT, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trades (
      chain_n INTEGER NOT NULL, idx INTEGER NOT NULL, buy INTEGER NOT NULL, wallet TEXT NOT NULL, quote TEXT NOT NULL, tokens TEXT NOT NULL,
      pons_block INTEGER NOT NULL, pons_tx TEXT NOT NULL, pons_log INTEGER NOT NULL, hash TEXT NOT NULL,
      l2_block INTEGER NOT NULL, l2_tx TEXT NOT NULL, mirrored_at INTEGER NOT NULL,
      PRIMARY KEY (chain_n, idx)
    );
    CREATE INDEX IF NOT EXISTS trades_tx ON trades (chain_n, pons_tx);
    CREATE INDEX IF NOT EXISTS trades_block ON trades (chain_n, l2_block);
    CREATE INDEX IF NOT EXISTS trades_recent ON trades (mirrored_at);
    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
  `);
  return db;
}

export const chainByN = (n: number) => getDb().prepare("SELECT * FROM chains WHERE n = ?").get(n) as ChainRow | undefined;
export const chainByToken = (token: string) => getDb().prepare("SELECT * FROM chains WHERE token = ?").get(token.toLowerCase()) as ChainRow | undefined;
export const chainByChainId = (id: number) => getDb().prepare("SELECT * FROM chains WHERE chain_id = ?").get(id) as ChainRow | undefined;

export const setMeta = (k: string, v: string | number) => void getDb().prepare("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(k, String(v));
export const getMeta = (k: string) => (getDb().prepare("SELECT v FROM meta WHERE k = ?").get(k) as { v: string } | undefined)?.v;
