// Launching a token on Pons from the visitor's own wallet. We only build and check the call; the wallet signs and sends it.
// The ABI and flow follow Pons v2 (docs.ponsfamily.com/v2), as used in the deadroom project.
import { decodeFunctionData, encodeFunctionData, parseAbi, parseEther, toHex, zeroAddress, type Hex } from "viem";
import { randomBytes } from "node:crypto";
import { client, decodeLaunch, PONS, SIG, type Launch, type RawLog } from "./pons.ts";

export const ROUTER = (process.env.PONS_ROUTER ?? "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948") as Hex;
const FACTORY = PONS.factory as Hex;

const STRUCTS = [
  "struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }",
  "struct TokenParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 expectedEconomics; bytes32 salt; }",
] as const;
const factoryAbi = parseAbi([
  ...STRUCTS,
  "struct LaunchConfig { uint256 supply; uint256 curveFeeBps; uint256 phantomQuote; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; bool enabled; }",
  "function launchConfigCount() view returns (uint256)",
  "function getLaunchConfig(uint256 id) view returns (LaunchConfig)",
  "function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)",
  "function launchFee() view returns (uint256)",
  "function canLaunch(address) view returns (bool)",
  "function launchToken(TokenParams params, uint256 launchConfigId, address pairToken) payable returns (address token, address curve)",
]);
const routerAbi = parseAbi([
  ...STRUCTS,
  "function launchAndBuy(TokenParams params, uint256 launchConfigId, address pairToken, uint256 quoteIn, uint256 minTokensOut, address recipient, address[] snipeTaxExemptions) payable returns (address token, address curve, uint256 tokensOut)",
]);

/** Every launch made through this site carries this tag at the start of its salt, so the chain can tell ours from launches made elsewhere. */
export const SALT_TAG = toHex("spawn"); // 5 bytes
export const newSalt = (): Hex => (SALT_TAG + randomBytes(32 - (SALT_TAG.length - 2) / 2).toString("hex")) as Hex; // the rest of the 32 bytes is random

export type LaunchInput = {
  from: Hex;
  name: string;
  symbol: string;
  description?: string;
  logo?: string;
  socials?: Partial<{ twitter: string; telegram: string; discord: string; website: string; farcaster: string }>;
  buybackEnabled?: boolean;
  buyEth?: string; // optional first buy by the launcher, in ETH
};
export type Prepared = { to: Hex; data: Hex; value: Hex; launchFeeWei: string; buyWei: string; tokensOut: string | null; salt: Hex };

const clean = (s: string | undefined, max: number) => (s ?? "").trim().slice(0, max);

async function enabledConfig(): Promise<bigint> {
  const count = await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "launchConfigCount" });
  for (let i = 0n; i < count; i++) {
    const c = await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "getLaunchConfig", args: [i] });
    if (c.enabled) return i;
  }
  throw new Error("Pons has no launch option switched on right now.");
}

/** Checks the launch would work (a dry run from the wallet's address) and returns the transaction for the wallet to send. */
export async function prepareLaunch(i: LaunchInput): Promise<Prepared> {
  const name = clean(i.name, 40);
  const symbol = clean(i.symbol, 12);
  if (!name || !symbol) throw new Error("A token needs a name and a symbol.");
  const buyWei = i.buyEth && Number(i.buyEth) > 0 ? parseEther(i.buyEth) : 0n;
  if (buyWei > parseEther("5")) throw new Error("The first buy is capped at 5 ETH here.");

  if (!(await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "canLaunch", args: [i.from] }))) throw new Error("Pons is not letting this wallet launch right now.");
  const [configId, launchFee] = await Promise.all([enabledConfig(), client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "launchFee" })]);
  const expectedEconomics = await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "previewLaunchEconomics", args: [configId, zeroAddress] });
  const salt = newSalt();
  const s = i.socials ?? {};
  const params = {
    name,
    symbol,
    logo: clean(i.logo, 300),
    description: clean(i.description, 600),
    socials: { twitter: clean(s.twitter, 200), telegram: clean(s.telegram, 200), discord: clean(s.discord, 200), website: clean(s.website, 200), farcaster: clean(s.farcaster, 200) },
    creatorFeeRecipient: i.from,
    creatorTaxBps: 0,
    buybackEnabled: i.buybackEnabled ?? true,
    expectedEconomics,
    salt,
  } as const;

  if (buyWei === 0n) {
    const args = [params, configId, zeroAddress] as const;
    await client.simulateContract({ address: FACTORY, abi: factoryAbi, functionName: "launchToken", args, value: launchFee, account: i.from });
    return { to: FACTORY, data: encodeFunctionData({ abi: factoryAbi, functionName: "launchToken", args }), value: toHex(launchFee), launchFeeWei: launchFee.toString(), buyWei: "0", tokensOut: null, salt };
  }
  const dry = [params, configId, zeroAddress, buyWei, 0n, i.from, []] as const;
  const sim = await client.simulateContract({ address: ROUTER, abi: routerAbi, functionName: "launchAndBuy", args: dry, value: launchFee + buyWei, account: i.from });
  const tokensOut = sim.result[2];
  const args = [params, configId, zeroAddress, buyWei, (tokensOut * 90n) / 100n, i.from, []] as const; // a buy that lands 10% short fails instead of filling badly
  return { to: ROUTER, data: encodeFunctionData({ abi: routerAbi, functionName: "launchAndBuy", args }), value: toHex(launchFee + buyWei), launchFeeWei: launchFee.toString(), buyWei: buyWei.toString(), tokensOut: tokensOut.toString(), salt };
}

/** Reads a launch transaction: which token it made, who launched it, and whether it was made through this site (by the salt tag). */
export async function inspectLaunchTx(hash: Hex): Promise<(Launch & { ours: boolean }) | null> {
  const [rc, tx] = await Promise.all([client.getTransactionReceipt({ hash }).catch(() => null), client.getTransaction({ hash }).catch(() => null)]);
  if (!rc || !tx || rc.status !== "success") return null;
  const log = rc.logs.find((l) => l.address.toLowerCase() === PONS.factory && l.topics[0] === SIG.launched);
  if (!log) return null;
  const launch = decodeLaunch({ address: log.address, topics: log.topics as string[], data: log.data, blockNumber: toHex(log.blockNumber), logIndex: toHex(log.logIndex), transactionHash: log.transactionHash } as RawLog);
  let ours = false;
  for (const abi of [routerAbi, factoryAbi] as const) {
    try {
      const d = decodeFunctionData({ abi: abi as never, data: tx.input }) as { args: readonly unknown[] };
      const p = d.args[0] as { salt: string };
      ours = p.salt.toLowerCase().startsWith(SALT_TAG.toLowerCase());
      break;
    } catch {}
  }
  return { ...launch, ours };
}

/** What the launch page needs to show a wallet card: whether Pons lets this wallet launch, and the launch fee right now. */
export async function launchGate(address: Hex): Promise<{ canLaunch: boolean; launchFeeWei: bigint }> {
  const [canLaunch, launchFeeWei] = await Promise.all([
    client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "canLaunch", args: [address] }),
    client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "launchFee" }),
  ]);
  return { canLaunch, launchFeeWei };
}
