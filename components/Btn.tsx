// A button or link with the facet fill. motion/fill.ts animates .fill on hover; CSS handles touch and reduced motion.
import Link from "next/link";
import type { ReactNode } from "react";

type Common = { variant?: "primary" | "ghost"; small?: boolean; children: ReactNode; className?: string };
const cls = ({ variant = "primary", small, className = "" }: Common) => `btn${variant === "ghost" ? " btn--ghost" : ""}${small ? " btn--sm" : ""} ${className}`.trim();

export function BtnLink({ href, ...c }: Common & { href: string }) {
  return (
    <Link href={href} className={cls(c)} data-fill>
      <span className="fill" aria-hidden="true" />
      {c.children}
    </Link>
  );
}

export function BtnButton({ type = "button", disabled, onClick, ...c }: Common & { type?: "button" | "submit"; disabled?: boolean; onClick?: () => void }) {
  return (
    <button type={type} className={cls(c)} data-fill disabled={disabled} onClick={onClick}>
      <span className="fill" aria-hidden="true" />
      {c.children}
    </button>
  );
}
