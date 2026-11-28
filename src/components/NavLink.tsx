"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-100 outline-none focus-visible:ring-2 focus-visible:ring-focus",
        "active:scale-[0.97]",
        active ? "bg-primary-light text-primary" : "text-fg-secondary hover:bg-hover hover:text-fg",
      )}
    >
      <PendingLabel>{children}</PendingLabel>
    </Link>
  );
}

/** Highlights a link the moment it's clicked, before the next screen arrives. */
export function PendingLabel({ children }: { children?: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {children}
      <span
        aria-hidden
        className={cx(
          "absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary transition-opacity",
          pending ? "animate-pulse opacity-100" : "opacity-0",
        )}
      />
    </>
  );
}
