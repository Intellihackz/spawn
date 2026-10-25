import Link from "next/link";
import { BtnLink } from "./Btn.tsx";

export function Footer() {
  return (
    <footer className="foot is-light">
      <div className="wrap">
        <div className="foot__top">
          <p className="foot__claim">The chains mirror trades. They don&apos;t settle them.</p>
          <nav className="foot__links" aria-label="Footer">
            <BtnLink href="/launch">Launch a token</BtnLink>
            <Link href="/chains" className="draw">
              All chains
            </Link>
            <Link href="/#how" className="draw">
              How a chain is spawned
            </Link>
          </nav>
        </div>
        <p className="foot__word" aria-hidden="true">
          spawn
        </p>
        <div className="foot__legal">
          <span>Trading happens on Pons. A chain holds a record that anyone can check against Pons, and it holds no funds.</span>
          <span>Experimental software. Not financial advice. Not affiliated with Pons.</span>
        </div>
      </div>
    </footer>
  );
}
