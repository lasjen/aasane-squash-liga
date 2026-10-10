import Link from "next/link";

import { adminCorrectResult } from "@/app/actions/results";
import { AdminMatch } from "@/components/admin-match";
import { MatchList } from "@/components/match-list";
import { formatRoundDate } from "@/lib/dates";
import { getFinishedRound, getFinishedRounds } from "@/lib/round-history";
import { getRoundMatches } from "@/lib/round-matches";
import { getGroups } from "@/lib/rounds";

/** Liste over avsluttede runder. `basePath` er /resultater eller /admin/resultater. */
export async function FinishedRoundList({ basePath }: { basePath: string }) {
  const rounds = await getFinishedRounds();

  if (rounds.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">Ingen runder er ferdigspilt ennå.</p>;
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {rounds.map((r) => (
        <li key={r.id}>
          <Link
            href={`${basePath}/${r.id}`}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <span className="font-medium first-letter:uppercase">{formatRoundDate(r.playedOn)}</span>
            <span className="text-sm text-zinc-500">
              {r.season} · runde {r.number}
            </span>
            <span className="ml-auto text-sm text-zinc-500">
              {r.participants} spillere · best av {r.bestOf}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RankingChange({ before, after }: { before: number | null; after: number | null }) {
  if (after === null) return <span className="text-zinc-500">–</span>;
  if (before === null) return <span>{after} <span className="text-xs text-zinc-500">(ny)</span></span>;
  const diff = before - after;
  return (
    <span className="tabular-nums">
      {before} → {after}
      {diff !== 0 && (
        <span className={`ml-1.5 text-xs ${diff > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
          {diff > 0 ? `▲${diff}` : `▼${-diff}`}
        </span>
      )}
    </span>
  );
}

/**
 * Resultatlisten for en avsluttet runde, med endring i ranking og alle kampene.
 * Returnerer null hvis runden ikke finnes eller ikke er avsluttet.
 */
export async function RoundResults({
  roundId,
  highlight,
  adminEditable = false,
}: {
  roundId: number;
  highlight?: number;
  /** Admin kan registrere og rette resultater (bare siste avsluttede runde). */
  adminEditable?: boolean;
}) {
  const round = await getFinishedRound(roundId);
  if (!round) return null;
  const [groups, matches] = await Promise.all([getGroups(roundId), getRoundMatches(roundId)]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          {round.season} · runde {round.number} · best av {round.bestOf} sett
        </p>
        <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">
          {formatRoundDate(round.playedOn)}
        </h1>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Resultatliste</h2>
        {round.results.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            Resultatlisten er ikke laget for denne runden.
          </p>
        ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 text-right font-medium">#</th>
                <th className="px-3 py-2 font-medium">Navn</th>
                <th className="px-3 py-2 font-medium">Gruppe</th>
                <th className="px-3 py-2 font-medium">Kamper</th>
                <th className="px-3 py-2 font-medium">Sett</th>
                <th className="px-3 py-2 font-medium">Ranking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {round.results.map((r) => (
                <tr key={r.playerId} className={r.playerId === highlight ? "bg-zinc-100 font-medium dark:bg-zinc-900" : undefined}>
                  <td className="px-3 py-2 text-right tabular-nums">{r.position}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                    {r.groupNumber} ({r.groupPosition}. plass)
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.wins}–{r.losses}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.setsWon}–{r.setsLost}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <RankingChange before={r.rankingBefore} after={r.rankingAfter} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        <p className="text-sm text-zinc-500">
          Vinneren av hver gruppe rykker opp forbi sistemann i gruppen over. Spillere som ikke var
          med, rykket 2 plasser ned i rankingen.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Kamper</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="font-medium">Gruppe {group.number}</h3>
              {adminEditable ? (
                <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {matches
                    .filter((m) => m.groupId === group.id)
                    .map((m) => (
                      <AdminMatch
                        key={m.id}
                        match={m}
                        bestOf={round.bestOf}
                        saveAction={adminCorrectResult.bind(null, m.id)}
                      />
                    ))}
                </ol>
              ) : (
                <MatchList matches={matches.filter((m) => m.groupId === group.id)} highlight={highlight} />
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
