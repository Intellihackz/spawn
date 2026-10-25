// Wallets link a transaction hash to "<explorer>/tx/<hash>". Our mirror transactions are blocks of trades, so this sends them to the block.
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db.ts";
import { chainFor } from "@/lib/queries.ts";

export const dynamic = "force-dynamic";

export default async function Tx({ params }: { params: Promise<{ id: string; hash: string }> }) {
  const { id, hash } = await params;
  const c = chainFor(Number(id));
  if (!c) notFound();
  const r = getDb().prepare("SELECT l2_block FROM trades WHERE chain_n = ? AND l2_tx = ? LIMIT 1").get(c.n, hash.toLowerCase()) as { l2_block: number } | undefined;
  if (!r) notFound();
  redirect(`/chain/${id}/block/${r.l2_block}`);
}
