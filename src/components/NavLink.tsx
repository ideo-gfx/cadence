"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus",
        active ? "bg-primary-light text-primary" : "text-fg-secondary hover:bg-hover hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}
