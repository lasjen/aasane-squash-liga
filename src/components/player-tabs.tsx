"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Spillerens sider. Hver fane er en egen side med egen adresse. */
const TABS = [
  { href: "/pamelding", label: "Påmelding" },
  { href: "/liga", label: "Liga", onlyWhenLeagueOpen: true },
  { href: "/ranking", label: "Ranking" },
  { href: "/resultater", label: "Resultater" },
  { href: "/regler", label: "Regler" },
  { href: "/innstillinger", label: "Innstillinger" },
];

/** `leagueOpen`: om admin har startet en runde. Liga-fanen vises bare da. */
export function PlayerTabs({ leagueOpen }: { leagueOpen: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => leagueOpen || !tab.onlyWhenLeagueOpen);

  return (
    <nav aria-label="Spillersider" className="mx-auto flex w-full max-w-2xl gap-1 overflow-x-auto px-4">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
              active
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
