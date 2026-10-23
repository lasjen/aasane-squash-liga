import { asc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { LeagueSwitch, leagueFromParams } from "@/components/league-switch";
import { db, schema } from "@/db";
import { getCurrentPlayer } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { isWomensLeagueMember, MIN_WOMENS_LEAGUE_PLAYERS, type League } from "@/lib/leagues";
import { LEVEL_LABELS } from "@/lib/player-options";
import { getRankingInfo } from "@/lib/ranking-info";

export const metadata: Metadata = { title: "Ranking – Torsdagsligaen" };

type Params = Record<string, string | string[] | undefined>;

export default function RankingPage({ searchParams }: PageProps<"/ranking">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Ranking</h1>
      <Suspense fallback={<p className="text-zinc-500">Henter ranking …</p>}>
        <Ranking searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Ranking({ searchParams }: { searchParams: Promise<Params> }) {
  // Åpen for alle; innloggede spillere får sin egen plass uthevet.
  const me = await getCurrentPlayer();
  const league = leagueFromParams(await searchParams);
  const info = await getRankingInfo();
  const players = await db
    .select({
      id: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      level: schema.players.level,
      gender: schema.players.gender,
      wantsWomensLeague: schema.players.wantsWomensLeague,
      ranking: schema.players.ranking,
      womenRanking: schema.players.womenRanking,
    })
    .from(schema.players)
    .where(eq(schema.players.active, true))
    .orderBy(
      sql`${schema.players.ranking} asc nulls last`,
      asc(schema.players.lastName),
      asc(schema.players.firstName),
    );

  const women = players
    .filter((p) => p.womenRanking !== null)
    .sort((a, b) => a.womenRanking! - b.womenRanking!);
  const switcher = (
    <LeagueSwitch
      basePath="/ranking"
      league={league}
      counts={{ open: players.filter((p) => p.ranking !== null).length, women: women.length }}
    />
  );

  if (league === "women") {
    return (
      <>
        {switcher}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Dameligaen spilles når minst {MIN_WOMENS_LEAGUE_PLAYERS} påmeldte kvinner har krysset av for
          dameliga under Innstillinger. Mens de spiller dameliga, beholder de plassen sin i «Alle».
        </p>
        {women.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">Ingen har meldt seg til dameligaen ennå.</p>
        ) : (
          <>
            <UpdatedAt league={league} at={info.updatedAt.women} />
            <RankingList
              meId={me?.id}
              rows={women.map((p) => ({ ...p, place: p.womenRanking! }))}
            />
          </>
        )}
      </>
    );
  }

  const ranked = players.filter((p) => p.ranking !== null);
  const unranked = players.filter((p) => p.ranking === null);

  if (ranked.length === 0) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        Rankingen er ikke satt opp ennå. Den kommer når en admin har oppdatert den.
      </p>
    );
  }

  return (
    <>
      {women.length > 0 && switcher}
      {info.message && (
        <section className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm whitespace-pre-line dark:border-zinc-800 dark:bg-zinc-900">
          {info.message}
        </section>
      )}

      <UpdatedAt league={league} at={info.updatedAt.open} />
      <RankingList
        meId={me?.id}
        rows={ranked.map((p) => ({ ...p, place: p.ranking!, tag: isWomensLeagueMember(p) ? "dameliga" : undefined }))}
      />

      {unranked.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Ikke rangert ennå</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nye spillere får plass neste gang en admin oppdaterer rankingen.
          </p>
          <ul className="text-zinc-700 dark:text-zinc-300">
            {unranked.map((p) => (
              <li key={p.id} className={p.id === me?.id ? "font-medium" : undefined}>
                {p.firstName} {p.lastName}
                {p.id === me?.id && <span className="ml-2 text-sm font-normal text-zinc-500">(deg)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function UpdatedAt({ league, at }: { league: League; at: Date | null }) {
  if (!at) return null;
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      {league === "women" ? "Dameligaens ranking" : "Rankingen"} ble sist oppdatert {formatDateTime(at)}.
    </p>
  );
}

type Row = {
  id: number;
  place: number;
  firstName: string;
  lastName: string;
  level: keyof typeof LEVEL_LABELS | null;
  /** Liten merkelapp etter navnet, f.eks. «dameliga». */
  tag?: string;
};

function RankingList({ rows, meId }: { rows: Row[]; meId?: number }) {
  return (
    <ol className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {rows.map((p) => {
        const isMe = p.id === meId;
        return (
          <li
            key={p.id}
            aria-current={isMe ? "true" : undefined}
            className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? "bg-zinc-100 font-medium dark:bg-zinc-900" : ""}`}
          >
            <span className="w-8 text-right tabular-nums text-zinc-500">{p.place}.</span>
            <span className="flex-1">
              {p.firstName} {p.lastName}
              {isMe && <span className="ml-2 text-sm font-normal text-zinc-500">(deg)</span>}
              {p.tag && (
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {p.tag}
                </span>
              )}
            </span>
            <span className="text-sm text-zinc-500">{p.level ? LEVEL_LABELS[p.level] : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
