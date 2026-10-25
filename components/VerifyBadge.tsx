"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type V = { ok: boolean; mirrored: number; ponsTrades: number; reason: string | null };

/** One link from the first paint, whose text and colour change when the check comes back. It stays the same element so it never counts as a late arrival. */
export function VerifyBadge({ chainId }: { chainId: number }) {
  const [v, setV] = useState<V | "error" | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/verify/${chainId}`)
      .then((r) => r.json())
      .then((d) => live && setV(d.error ? "error" : d))
      .catch(() => live && setV("error"));
    return () => {
      live = false;
    };
  }, [chainId]);
  const cls = v && v !== "error" ? (v.ok ? "chip ok" : "chip bad") : "chip";
  const text = !v ? "Checking against Pons…" : v === "error" ? "Check unavailable" : v.ok ? `Matches Pons, ${v.mirrored} trades` : `Does not match Pons: ${v.reason}`;
  return (
    <Link href={`/verify/${chainId}`} className={cls} aria-live="polite">
      {text}
    </Link>
  );
}
