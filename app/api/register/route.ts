// Gives a Pons token its own chain, in one of two ways:
//  1. { txHash }: the launch transaction of a token launched through this site (its salt carries our tag). The wallet already proved itself by sending it.
//  2. { message, signature }: a token launched elsewhere on Pons. The caller signs with the wallet that launched it; only the launcher can claim it.
import { recoverMessageAddress, type Hex } from "viem";
import { chainByToken, getDb } from "@/lib/db.ts";
import { capReason } from "@/lib/caps.ts";
import { chainIdOf } from "@/lib/consts.ts";
import { inspectLaunchTx } from "@/lib/launch.ts";
import { ipOf, limited } from "@/lib/limit.ts";
import { findLaunch, tokenFacts, type Launch } from "@/lib/pons.ts";

export const dynamic = "force-dynamic";
const MSG = /^Spawn\nGive token (0x[0-9a-fA-F]{40}) its own chain\.\nIssued (\d+)$/;
const bad = (error: string, status = 400) => Response.json({ error }, { status });

async function insert(launch: Launch) {
  const existing = chainByToken(launch.token);
  if (existing) return Response.json({ chainId: chainIdOf(existing.n), already: true });
  const full = capReason(launch.deployer);
  if (full) return bad(`Your token launched on Pons, but it could not get a chain. ${full}`, 409);
  const f = await tokenFacts(launch);
  try {
    const r = getDb()
      .prepare("INSERT INTO chains (token, curve, pair, pair_symbol, pair_decimals, name, symbol, creator, launch_tx, launch_block, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'pending', ?)")
      .run(launch.token, launch.curve, launch.pair, f.pairSymbol, f.pairDecimals, f.name, f.symbol, launch.deployer, launch.tx, launch.block, Math.floor(Date.now() / 1000));
    return Response.json({ chainId: chainIdOf(Number(r.lastInsertRowid)), already: false });
  } catch {
    const again = chainByToken(launch.token);
    if (again) return Response.json({ chainId: chainIdOf(again.n), already: true });
    return bad("Could not register that token.", 500);
  }
}

export async function POST(req: Request) {
  if (limited("reg:" + ipOf(req), 6, 60_000)) return bad("Too many tries. Wait a minute.", 429);
  const body = (await req.json().catch(() => null)) as { txHash?: string; message?: string; signature?: string } | null;
  if (!body) return bad("Bad request.");

  if (body.txHash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(body.txHash)) return bad("That is not a transaction hash.");
    const l = await inspectLaunchTx(body.txHash as Hex);
    if (!l) return bad("That transaction is not a finished Pons launch yet. Try again in a few seconds.", 404);
    if (!l.ours) return bad("That launch was not made through Spawn.", 403);
    return insert(l);
  }

  const m = body.message?.match(MSG);
  if (!body.message || !body.signature || !m) return bad("That is not a Spawn claim message.");
  const token = m[1].toLowerCase();
  if (Math.abs(Date.now() / 1000 - Number(m[2])) > 600) return bad("That signature is more than ten minutes old. Sign again.");
  let signer: string;
  try {
    signer = (await recoverMessageAddress({ message: body.message, signature: body.signature as Hex })).toLowerCase();
  } catch {
    return bad("That signature could not be read.");
  }
  const existing = chainByToken(token);
  if (existing) return Response.json({ chainId: chainIdOf(existing.n), already: true });
  const launch = await findLaunch(token);
  if (!launch) return bad("That address is not a token launched on Pons.");
  if (launch.deployer !== signer) return bad("Only the wallet that launched this token can give it a chain.", 403);
  return insert(launch);
}
