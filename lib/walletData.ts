"use client";
// What the launch page knows about the connected wallet: its balance on Robinhood Chain, the live Pons launch fee, whether Pons lets it launch,
// and the chains it has already spawned. One hook, shared by the form and the summary, so they always agree.
import { useCallback, useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";

export type WalletData = { balanceWei: string; launchFeeWei: string; canLaunch: boolean; capReason: string | null; chains: { chainId: number; symbol: string; name: string; count: number }[] };
export type WalletRead = { d: WalletData | null; busy: boolean; err: string; reload: () => void };

export function useWalletData(account: string | null): WalletRead {
  const [d, setD] = useState<WalletData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async (a: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/wallet?address=${a}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not read the wallet.");
      setD(j);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!account) { setD(null); setErr(""); return; }
    void load(account);
    const id = setInterval(() => { if (document.visibilityState === "visible") void load(account); }, 20000);
    return () => clearInterval(id);
  }, [account, load]);

  return { d, busy, err, reload: () => { if (account) void load(account); } };
}

/** ETH for people: no trailing zeros, no long tails. */
export const eth = (wei: bigint) => {
  const n = Number(formatEther(wei));
  return n === 0 ? "0" : n < 0.00001 ? n.toExponential(2) : n.toFixed(5).replace(/\.?0+$/, "");
};

export type Form = { name: string; symbol: string; description: string; logo: string; twitter: string; telegram: string; website: string; buyEth: string; buyback: boolean };
export const EMPTY_FORM: Form = { name: "", symbol: "", description: "", logo: "", twitter: "", telegram: "", website: "", buyEth: "", buyback: true };

/** What this launch costs, and whether the balance covers it. `short` is null until the balance has been read. */
export function costOf(f: Form, d: WalletData | null) {
  let buy = 0n;
  try { buy = Number(f.buyEth) > 0 ? parseEther(f.buyEth) : 0n; } catch {}
  const fee = d ? BigInt(d.launchFeeWei) : 0n;
  const balance = d ? BigInt(d.balanceWei) : 0n;
  const total = fee + buy;
  return { buy, fee, balance, total, short: d ? balance < total : null };
}
