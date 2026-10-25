"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type T = { chainId: number; idx: number; buy: boolean; wallet: string; symbol: string; tokens: string; quote: string; pair: string; at: number };
const ago = (t: number) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - t);
  return s < 5 ? "now" : s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
};

export function Ticker({ initial }: { initial: T[] }) {
  const [rows, setRows] = useState<T[]>(initial);
  useEffect(() => {
    let live = true;
    const pull = () =>
      fetch("/api/feed")
        .then((r) => r.json())
        .then((d) => live && setRows(d.trades))
        .catch(() => {});
    const id = setInterval(() => document.visibilityState === "visible" && pull(), 4000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  if (!rows.length) return <p className="empty">No trades mirrored yet. The first one lands here.</p>;
  return (
    <ul className="ticker" aria-label="Latest mirrored trades">
      {rows.slice(0, 12).map((t) => (
        <li key={`${t.chainId}-${t.idx}`}>
          <span className={`side ${t.buy ? "buy" : "sell"}`}>{t.buy ? "BUY" : "SELL"}</span>
          <Link href={`/chain/${t.chainId}/trade/${t.idx}`} className="tk-main">
            <b>{t.tokens}</b> {t.symbol} <span className="muted">for {t.quote} {t.pair}</span>
          </Link>
          <Link href={`/chain/${t.chainId}`} className="tk-chain">
            {t.chainId}
          </Link>
        </li>
      ))}
    </ul>
  );
}
