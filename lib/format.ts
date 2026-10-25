import { formatUnits } from "viem";

export const short = (h: string, a = 6, b = 4) => (h.length > a + b + 2 ? `${h.slice(0, a + 2)}…${h.slice(-b)}` : h);

/** 1234567.891 -> "1.23M". Small numbers keep their significant digits. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(2) + "K";
  if (a === 0) return "0";
  if (a >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}
export const units = (raw: string | bigint, decimals = 18) => compact(Number(formatUnits(BigInt(raw), decimals)));

export function ago(ts: number, now = Math.floor(Date.now() / 1000)): string {
  const s = Math.max(0, now - ts);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const stamp = (ts: number) => new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";

export const ponsTxUrl = (tx: string) => (process.env.NEXT_PUBLIC_PONS_EXPLORER ? `${process.env.NEXT_PUBLIC_PONS_EXPLORER.replace(/\/$/, "")}/tx/${tx}` : null);
