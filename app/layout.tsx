import type { Metadata } from "next";
import { Footer } from "@/components/Footer.tsx";
import { Header } from "@/components/Header.tsx";
import { Motion } from "@/components/Motion.tsx";
import { Toaster } from "@/components/Toast.tsx";
import { archivo, dmMono } from "./fonts.ts";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const TITLE = "Spawn: every launch spawns its own chain";
const DESC = "Launch a token on Pons and a chain spawns for it that mirrors every trade. Anyone can rebuild the hash from Pons and check it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s | Spawn" },
  description: DESC,
  alternates: { canonical: "./" },
  openGraph: { type: "website", siteName: "Spawn", title: TITLE, description: DESC, images: [{ url: "/og.png", width: 1200, height: 630, alt: "A grid of blocks drawn from a chain's hash, with the words every launch spawns its own chain" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og.png"] },
};

// Runs before first paint: hidden-until-revealed styles only apply when JS runs and motion is allowed.
const flags = `document.documentElement.classList.add('js');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('motion')`;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: "Spawn", url: SITE, description: DESC, inLanguage: "en" },
    { "@type": "WebApplication", name: "Spawn", url: SITE + "/launch", applicationCategory: "FinanceApplication", operatingSystem: "Web", browserRequirements: "A browser with a wallet extension", description: DESC },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${dmMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: flags }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div id="curtain" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div className="col" key={i}>
              <span className="a" />
              <span className="b" />
            </div>
          ))}
          <i className="reading" />
        </div>
        <Header />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <Toaster />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <Motion />
      </body>
    </html>
  );
}
