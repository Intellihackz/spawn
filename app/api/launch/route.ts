// Builds the launch transaction for the visitor's wallet to sign. Nothing here sends anything.
import { capReason } from "@/lib/caps.ts";
import { prepareLaunch } from "@/lib/launch.ts";
import { ipOf, limited } from "@/lib/limit.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (limited("launch:" + ipOf(req), 12, 60_000)) return Response.json({ error: "Too many tries. Wait a minute." }, { status: 429 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b.from !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(b.from)) return Response.json({ error: "Connect a wallet first." }, { status: 400 });
  // refuse before the wallet pays Pons anything: a token launched with no room for its chain would have no chain
  const full = capReason(b.from);
  if (full) return Response.json({ error: full }, { status: 409 });
  try {
    const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : undefined);
    const s = (b.socials ?? {}) as Record<string, string>;
    const p = await prepareLaunch({
      from: b.from.toLowerCase() as `0x${string}`, // wallets differ in address casing
      name: str("name") ?? "",
      symbol: str("symbol") ?? "",
      description: str("description"),
      logo: str("logo"),
      socials: { twitter: s.twitter, telegram: s.telegram, website: s.website },
      buybackEnabled: b.buybackEnabled !== false,
      buyEth: str("buyEth"),
    });
    return Response.json(p);
  } catch (e) {
    const msg = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? "The launch would fail.";
    return Response.json({ error: msg.split("\n")[0].slice(0, 240) }, { status: 400 });
  }
}
