import type { Metadata } from "next";
import { Suspense } from "react";

import { confirmMatchResult, reportResult } from "@/app/actions/results";
import { MatchList } from "@/components/match-list";
import { isPoolSource } from "@/lib/match-plan";
import { requirePlayer } from "@/lib/auth/session";
import { formatRoundDate } from "@/lib/dates";
import { getRoundMatches } from "@/lib/round-matches";
import { findStartedRound, getGroups } from "@/lib/rounds";

import { MyMatch } from "./my-match";

export const metadata: Metadata = { title: "Liga – Torsdagsligaen" };

export default function LeaguePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p className="text-zinc-500">Henter runden …</p>}>
        <League />
      </Suspense>
    </main>
  );
}

async function League() {
  const me = await requirePlayer();
  const round = await findStartedRound();

  // Fanen er skjult når ingen runde er i gang, men siden kan fortsatt åpnes med lenke.
  if (!round) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Liga</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Ingen runde er i gang nå. Liga-siden åpner når en admin starter runden.
        </p>
      </>
    );
  }

  const [allGroups, matches] = await Promise.all([getGroups(round.id), getRoundMatches(round.id)]);
  const myGroup = allGroups.find((g) => g.players.some((p) => p.id === me.id));
  // Egen gruppe først, så resten i rekkefølge.
  const groups = myGroup ? [myGroup, ...allGroups.filter((g) => g !== myGroup)] : allGroups;
  // Spillerens egne kamper. En vinner/taper-kamp tas med så lenge spilleren fortsatt kan havne i den,
  // altså når kampen som avgjør plassen er spillerens egen og ikke har resultat ennå.
  const isMine = (m: (typeof matches)[number]) =>
    [m.player1, m.player2].some((side) => side.kind === "player" && side.id === me.id);
  const groupMatches = matches.filter((m) => m.groupId === myGroup?.id);
  const myMatches = groupMatches.filter(
    (m) =>
      isMine(m) ||
      [m.player1, m.player2].some((side) => {
        if (side.kind !== "source") return false;
        if (isPoolSource(side.source)) {
          const poolA = groupMatches.filter((g) => g.pool === "A");
          return poolA.some(isMine) && poolA.some((g) => g.winnerId === null);
        }
        const sourceNumber = side.source.match;
        const source = groupMatches.find((g) => g.number === sourceNumber);
        return source !== undefined && isMine(source) && source.winnerId === null;
      }),
  );

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Runde {round.number} · i gang
        </p>
        <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">
          {formatRoundDate(round.playedOn)}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {myGroup ? `Du spiller i ${myGroup.label.toLowerCase()}.` : "Du er ikke med i denne runden."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group.id}
            className={`flex flex-col gap-2 rounded-lg border p-4 ${
              group === myGroup
                ? "border-zinc-900 dark:border-zinc-100"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <h2 className="font-semibold">
              {group.label}
              {group === myGroup && <span className="ml-2 text-sm font-normal text-zinc-500">(din gruppe)</span>}
            </h2>
            <ol className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
              {group.players.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 py-1.5 ${p.id === me.id ? "font-medium" : ""}`}
                >
                  <span className="w-7 text-right text-sm tabular-nums text-zinc-500">
                    {p.ranking ?? "–"}
                  </span>
                  <span>
                    {p.firstName} {p.lastName}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <MatchList matches={matches.filter((m) => m.groupId === group.id)} highlight={me.id} />
            </div>
          </section>
        ))}
      </div>

      {myMatches.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Dine kamper</h2>
          <ol className="flex flex-col gap-3">
            {myMatches.map((m) => (
              <MyMatch
                key={m.id}
                match={m}
                meId={me.id}
                bestOf={round.bestOf}
                reportAction={reportResult.bind(null, m.id)}
                confirmAction={confirmMatchResult.bind(null, m.id)}
              />
            ))}
          </ol>
          <p className="text-sm text-zinc-500">
            * betyr at resultatet venter på bekreftelse fra motspilleren.
          </p>
        </section>
      )}
    </>
  );
}
