import { type ReactNode, Suspense } from "react";

import { getLeagueSettings, type LeagueSettings } from "@/lib/league-settings";

/**
 * Tekst som bruker innstillingene fra admin, f.eks. maks antall spillere. Strømmes inn,
 * så resten av siden kan være statisk.
 */
export function WithLeagueSettings({ children }: { children: (settings: LeagueSettings) => ReactNode }) {
  return (
    <Suspense fallback="…">
      <Settings>{children}</Settings>
    </Suspense>
  );
}

async function Settings({ children }: { children: (settings: LeagueSettings) => ReactNode }) {
  return children(await getLeagueSettings());
}
