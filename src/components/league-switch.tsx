import Link from "next/link";

import { LEAGUE_LABELS, LEAGUES, type League } from "@/lib/leagues";

/** Verdien i adressen for hver liga: /ranking og /ranking?liga=kvinner. */
const PARAM: Record<League, string | null> = { open: null, women: "kvinner" };

/** Ligaen som er valgt i adressen (`?liga=kvinner`), ellers «Alle». */
export function leagueFromParams(params: Record<string, string | string[] | undefined>): League {
  return params.liga === PARAM.women ? "women" : "open";
}

/**
 * Underfaner for å velge mellom «Alle» og «Kvinner». Hver liga har egen adresse, så valget
 * kan deles som lenke og virker uten JavaScript.
 */
export function LeagueSwitch({
  basePath,
  league,
  counts,
}: {
  basePath: string;
  league: League;
  /** Antall spillere i hver ranking, vist i fanen. */
  counts?: Partial<Record<League, number>>;
}) {
  return (
    <nav
      aria-label="Velg ranking"
      className="inline-flex self-start rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {LEAGUES.map((l) => {
        const active = l === league;
        const param = PARAM[l];
        return (
          <Link
            key={l}
            href={param ? `${basePath}?liga=${param}` : basePath}
            aria-current={active ? "page" : undefined}
            scroll={false}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {LEAGUE_LABELS[l]}
            {counts?.[l] !== undefined && (
              <span className="ml-1.5 text-xs font-normal tabular-nums text-zinc-500">{counts[l]}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
