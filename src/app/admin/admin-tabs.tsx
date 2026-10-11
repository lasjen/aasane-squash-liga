"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Spillere", match: (p: string) => p === "/admin" || p.startsWith("/admin/spillere") },
  { href: "/admin/runde", label: "Ligarunde", match: (p: string) => p.startsWith("/admin/runde") },
  { href: "/admin/resultater", label: "Resultater", match: (p: string) => p.startsWith("/admin/resultater") },
  { href: "/admin/logg", label: "Logg", match: (p: string) => p.startsWith("/admin/logg"), adminOnly: true },
];

/** `isAdmin`: fanen «Logg» vises bare for admin. */
export function AdminTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => isAdmin || !("adminOnly" in tab));

  return (
    <nav aria-label="Admin" className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
              active
                ? "border-white text-white"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
