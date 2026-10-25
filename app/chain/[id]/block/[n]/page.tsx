import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, type TradeRow } from "@/lib/db.ts";
import { ago, short, stamp, units } from "@/lib/format.ts";
import { chainFor } from "@/lib/queries.ts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Block", description: "The trades written to a chain in one block, in order, with their hashes." };

export default async function Block({ params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const c = chainFor(Number(id));
  if (!c) notFound();
  const rows = getDb().prepare("SELECT * FROM trades WHERE chain_n = ? AND l2_block = ? ORDER BY idx").all(c.n, Number(n)) as TradeRow[];
  if (!rows.length) notFound();
  const b = Number(n);
  return (
    <div className="page wrap">
      <div className="page__head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/chains">Chains</Link>
          <Link href={`/chain/${id}`}>{c.symbol}</Link>
          <span>Block {b}</span>
        </nav>
        <h1 className="display" data-split="lines" data-intro>
          Block {b}
        </h1>
        <p className="lede" data-reveal="up" data-intro data-delay="0.2">
          {rows.length} {rows.length === 1 ? "trade" : "trades"}, from #{rows[0].idx} to #{rows[rows.length - 1].idx}, mirrored {ago(rows[0].mirrored_at)}.
        </p>
      </div>
      <dl className="kv">
        <dt>Mirrored</dt>
        <dd>{stamp(rows[0].mirrored_at)}</dd>
        <dt>Transaction</dt>
        <dd className="mono">{rows[0].l2_tx}</dd>
      </dl>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Side</th>
              <th>Wallet</th>
              <th>{c.symbol}</th>
              <th>{c.pair_symbol}</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.idx}>
                <td>
                  <Link href={`/chain/${id}/trade/${t.idx}`}>{t.idx}</Link>
                </td>
                <td className={t.buy ? "buy" : "sell"}>{t.buy ? "BUY" : "SELL"}</td>
                <td className="mono">{short(t.wallet, 4, 4)}</td>
                <td className="num">{units(t.tokens)}</td>
                <td className="num">{units(t.quote, c.pair_decimals)}</td>
                <td className="mono">{short(t.hash, 6, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        {b > 0 ? <Link className="mini" href={`/chain/${id}/block/${b - 1}`}>Previous block</Link> : <span />}
        <Link className="mini" href={`/chain/${id}/block/${b + 1}`}>Next block</Link>
      </div>
    </div>
  );
}
