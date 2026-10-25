"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BtnLink } from "./Btn.tsx";
import { Mark } from "./Mark.tsx";
import { WalletButton } from "./WalletButton.tsx";

export function Header() {
  const path = usePathname();
  const chains = path === "/chains" || path.startsWith("/chain/") || path.startsWith("/verify/");
  return (
    <header className="bar">
      <div className="bar__in">
        <Link href="/" className="brand" aria-label="Spawn, home">
          <Mark />
          spawn
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/chains" className="draw" aria-current={chains ? "page" : undefined}>
            Chains
          </Link>
          {/* on the launch page the wallet is the next step, so it takes the place of the launch button */}
          {path === "/launch" ? (
            <WalletButton />
          ) : (
            <BtnLink href="/launch" small>
              Launch a token
            </BtnLink>
          )}
        </nav>
      </div>
    </header>
  );
}
