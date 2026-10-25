import type { MetadataRoute } from "next";
import { chains } from "@/lib/queries.ts";

export const dynamic = "force-dynamic";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const fixed = ["/", "/chains", "/launch"].map((p) => ({ url: SITE + p }));
  const each = chains(500).filter((c) => c.status === "live").map((c) => ({ url: `${SITE}/chain/${c.chainId}` }));
  return [...fixed, ...each];
}
