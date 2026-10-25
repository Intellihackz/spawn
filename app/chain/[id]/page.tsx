import Link from "next/link";
import { notFound } from "next/navigation";
import { AddNetwork } from "@/components/AddNetwork.tsx";
import { ChainPicture } from "@/components/ChainPicture.tsx";
import { Copy } from "@/components/Copy.tsx";
import { LiveRefresh } from "@/components/LiveRefresh.tsx";
import { VerifyBadge } from "@/components/VerifyBadge.tsx";
import { ago, short, stamp, units } from "@/lib/format.ts";
import { blockCount, blocksPage, chainFor, hashOf, lastBlock, tradesPage } from "@/lib/queries.ts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const c = chainFor(Number(id));
  return c ? { title: `${c.symbol}, chain ${id}`, description: `${c.name} (${c.symbol}) on its own chain ${id}: ${c.count.toLocaleString()} Pons trades mirrored, with a hash anyone can rebuild from Pons.` } : { title: "Chain" };
}

export default async function ChainPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; page?: string }> }) {
  const id = Number((await params).id);
  const c = chainFor(id);
  if (!c) notFound();
  const { tab = "trades", page = "0" } = await searchParams;
  const p = Math.max(0, Number(page) || 0);
  const live = c.status === "live";
  const now = Math.floor(Date.now() / 1000);
  const trades = tab === "trades" ? tradesPage(c.n, p) : [];
  const blocks = tab === "blocks" ? blocksPage(c.n, p) : [];
  const last = lastBlock(c.n);
  const total = tab === "blocks" ? blockCount(c.n) : c.count;
  const per = tab === "blocks" ? 30 : 40;
  const q = (t: string, n: number) => `/chain/${id}?tab=${t}&page=${n}`;
  const hash = hashOf(c);

  return (
    <div className="page wrap">
      <LiveRefresh every={5000} />
      <div className="page__head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/chains">Chains</Link>
          <span>{c.symbol}</span>
        </nav>
        <h1 className="display" data-split="lines" data-intro>
          {c.symbol}
        </h1>
        <p className="lede muted" data-reveal="up" data-intro data-delay="0.2">
          {c.name}
        </p>
      </div>

      <div className="explorer">
        <aside className="specimen" aria-label="Chain picture and facts">
          <ChainPicture hash={hash} symbol={c.symbol} chainId={id} count={c.count} />
          <div className="label">
            <span className="no">Chain {id}</span>
            <dl>
              <dt>Status</dt>
              <dd>
                <span className={`chip${live ? " live" : ""}`}>{live ? "Live" : c.status === "error" ? "Retrying" : "Starting up"}</span>
              </dd>
              <dt>Trades</dt>
              <dd>{c.count.toLocaleString()}</dd>
              <dt>Blocks</dt>
              <dd>{last ?? 0}</dd>
              <dt>Mirrors</dt>
              <dd>Pons, Robinhood Chain</dd>
            </dl>
            {live && (
              <div style={{ marginTop: 12 }}>
                <VerifyBadge chainId={id} />
              </div>
            )}
          </div>
        </aside>

        <div>
          <p className="mirror-note">This chain mirrors the trades of {c.symbol} on Pons. It does not settle them, and it holds no funds.</p>
          <dl className="kv">
            <dt>Head hash</dt>
            <dd>
              <span className="mono">{c.head ?? "no trades yet"}</span>
              {c.head && <Copy text={c.head} label="Copy hash" />}
            </dd>
            <dt>Ledger</dt>
            <dd>
              <span className="mono">{c.ledger ?? "not deployed yet"}</span>
              {c.ledger && <Copy text={c.ledger} label="Copy ledger" />}
            </dd>
            <dt>Token on Pons</dt>
            <dd>
              <span className="mono">{c.token}</span>
              <Copy text={c.token} label="Copy token" />
            </dd>
            <dt>Quoted in</dt>
            <dd>{c.pair_symbol}</dd>
            <dt>Launched by</dt>
            <dd className="mono">{c.creator}</dd>
            <dt>Network</dt>
            <dd>
              <span>Chain id {id}</span>
              <span className="mono">/rpc/{id}</span>
              {live && <AddNetwork chainId={id} symbol={c.symbol} />}
            </dd>
            <dt>Verify</dt>
            <dd>
              <Link href={`/verify/${id}`}>Rebuild the hash from Pons</Link>
            </dd>
          </dl>

          <nav className="tabs" aria-label="Explorer views">
            <Link href={q("trades", 0)} aria-current={tab === "trades" ? "page" : undefined}>
              Trades
            </Link>
            <Link href={q("blocks", 0)} aria-current={tab === "blocks" ? "page" : undefined}>
              Blocks
            </Link>
          </nav>

          <div className="tablewrap">
            {tab === "trades" ? (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Side</th>
                    <th>Wallet</th>
                    <th>{c.symbol}</th>
                    <th>{c.pair_symbol}</th>
                    <th>Block</th>
                    <th>Hash</th>
                    <th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.idx} data-hash={t.hash} data-idx={t.idx}>
                      <td>
                        <Link href={`/chain/${id}/trade/${t.idx}`}>{t.idx}</Link>
                      </td>
                      <td className={t.buy ? "buy" : "sell"}>{t.buy ? "BUY" : "SELL"}</td>
                      <td className="mono">{short(t.wallet, 4, 4)}</td>
                      <td className="num">{units(t.tokens)}</td>
                      <td className="num">{units(t.quote, c.pair_decimals)}</td>
                      <td className="num">{t.l2_block}</td>
                      <td className="mono">{short(t.hash, 6, 4)}</td>
                      <td className="muted">{ago(t.mirrored_at, now)}</td>
                    </tr>
                  ))}
                  {trades.length === 0 && (
                    <tr>
                      <td colSpan={8} className="muted">
                        {live ? "No trades mirrored yet. The first one lands here." : "Waiting for the chain to start."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Trades</th>
                    <th>Range</th>
                    <th>Transaction</th>
                    <th>Mirrored</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((b) => (
                    <tr key={b.l2_block}>
                      <td>
                        <Link href={`/chain/${id}/block/${b.l2_block}`}>{b.l2_block}</Link>
                      </td>
                      <td className="num">{b.n}</td>
                      <td className="num">
                        #{b.first} to #{b.last}
                      </td>
                      <td className="mono">{short(b.l2_tx, 8, 6)}</td>
                      <td className="muted" title={stamp(b.mirrored_at)}>
                        {ago(b.mirrored_at, now)}
                      </td>
                    </tr>
                  ))}
                  {blocks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        No blocks with trades yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          {(p > 0 || (p + 1) * per < total) && (
            <div className="pager">
              {p > 0 ? <Link className="mini" href={q(tab, p - 1)}>Newer</Link> : <span />}
              {(p + 1) * per < total && <Link className="mini" href={q(tab, p + 1)}>Older</Link>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
