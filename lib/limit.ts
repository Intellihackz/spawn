// A small per-address rate limit kept in memory. One web process, so this is enough.
const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return list.length > max;
}

type HeaderBag = { get(name: string): string | null };

/** The visitor's address as the nearest trusted proxy saw it. A client can put anything at the front of X-Forwarded-For, but a trusted
 *  proxy appends the real address at the end, so we count from the end: SPAWN_TRUSTED_HOPS is how many proxies sit in front of the app
 *  (1 for Railway alone, 2 with Cloudflare in front of Railway). SPAWN_CLIENT_IP_HEADER names the header, for hosts that use another one. */
export function ipFromHeaders(h: HeaderBag): string {
  const raw = h.get((process.env.SPAWN_CLIENT_IP_HEADER ?? "x-forwarded-for").toLowerCase());
  if (!raw) return "local";
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const hops = Math.max(1, Number(process.env.SPAWN_TRUSTED_HOPS ?? 1));
  return parts[Math.max(0, parts.length - hops)] ?? "local";
}
export const ipOf = (req: Request) => ipFromHeaders(req.headers);
