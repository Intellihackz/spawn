import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy } from "@/components/Copy.tsx";
import { Blocks } from "@/components/Blocks.tsx";
import { getDb, type TradeRow } from "@/lib/db.ts";
import { ponsTxUrl, short, stamp, units } from "@/lib/format.ts";
import { genesis } from "@/lib/hash.ts";
import { chainFor } from "@/lib/queries.ts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trade", description: "One Pons trade as it was mirrored onto its chain, with the hash before it and the hash after it." };

export default async function Trade({ params }: { params: Promise<{ id: string; idx: string }> }) {
  const { id, idx } = await params;
  const c = chainFor(Number(id));
  if (!c) notFound();
  const db = getDb();
  const t = db.prepare("SELECT * FROM trades WHERE chain_n = ? AND idx = ?").get(c.n, Number(idx)) as TradeRow | undefined;
  if (!t) notFound();
  const prev = t.idx > 1 ? (db.prepare("SELECT hash FROM trades WHERE chain_n = ? AND idx = ?").get(c.n, t.idx - 1) as { hash: string }).hash : null;
  const before = prev ?? genesis(c.token, c.curve);
  const url = ponsTxUrl(t.pons_tx);
  return (
    <div className="page wrap">
      <div className="page__head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/chains">Chains</Link>
          <Link href={`/chain/${id}`}>{c.symbol}</Link>
          <span>Trade {t.idx}</span>
        </nav>
        <h1 className="display" data-split="lines" data-intro>
          Trade {t.idx}
        </h1>
        <p className="lede" data-reveal="up" data-intro data-delay="0.2">
          <span className={t.buy ? "buy" : "sell"}>{t.buy ? "Buy" : "Sell"}</span> of {units(t.tokens)} {c.symbol} for {units(t.quote, c.pair_decimals)} {c.pair_symbol}.
        </p>
      </div>

      <div className="pair">
        <figure>
          <Blocks hash={before} label={`Blocks before trade ${t.idx}`} />
          <figcaption>
            {prev ? `Before: the hash after trade ${t.idx - 1}` : "Before: the chain's starting hash, from the token and its curve"}
            <span className="mono" style={{ display: "block", marginTop: 6 }}>{short(before, 10, 6)}</span>
          </figcaption>
        </figure>
        <figure>
          <Blocks hash={t.hash} label={`Blocks after trade ${t.idx}`} />
          <figcaption>
            After: the hash with this trade added
            <span className="mono" style={{ display: "block", marginTop: 6 }}>{short(t.hash, 10, 6)}</span>
          </figcaption>
        </figure>
      </div>
      <p className="muted small" style={{ maxWidth: "62ch", marginBottom: 26 }}>
        The new hash is made from the old one plus this trade&apos;s Pons transaction, log index, side, wallet and amounts. Change any of them and the hash, and its picture, changes. <Link href={`/verify/${id}`} className="draw" style={{ color: "var(--c-fg)" }}>Check the whole chain</Link>.
      </p>

      <dl className="kv">
        <dt>Wallet</dt>
        <dd className="mono">{t.wallet}</dd>
        <dt>{c.symbol}</dt>
        <dd>
          {units(t.tokens)} <span className="muted mono">({t.tokens})</span>
        </dd>
        <dt>{c.pair_symbol}</dt>
        <dd>
          {units(t.quote, c.pair_decimals)} <span className="muted mono">({t.quote})</span>
        </dd>
        <dt>Mirror block</dt>
        <dd>
          <Link href={`/chain/${id}/block/${t.l2_block}`}>{t.l2_block}</Link>
        </dd>
        <dt>Mirrored</dt>
        <dd>{stamp(t.mirrored_at)}</dd>
        <dt>Mirror transaction</dt>
        <dd className="mono">{t.l2_tx}</dd>
        <dt>Pons transaction</dt>
        <dd>
          <span className="mono">{t.pons_tx}</span>
          <Copy text={t.pons_tx} label="Copy tx" />
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer">
              View on Pons
            </a>
          )}
        </dd>
        <dt>Pons block</dt>
        <dd>
          {t.pons_block} <span className="muted">log {t.pons_log}</span>
        </dd>
        <dt>Full hash</dt>
        <dd className="mono">{t.hash}</dd>
      </dl>
    </div>
  );
}
