import { chainByN } from "@/lib/db.ts";
import { nOf } from "@/lib/consts.ts";
import { ipOf, limited } from "@/lib/limit.ts";
import { verifyChain } from "@/lib/verify.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (limited("verify:" + ipOf(req), 30, 60_000)) return Response.json({ error: "Too many checks. Wait a minute." }, { status: 429 });
  const c = chainByN(nOf(Number((await params).id)));
  if (!c || c.status !== "live") return Response.json({ error: "No live chain with that id." }, { status: 404 });
  try {
    return Response.json(await verifyChain(c));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
