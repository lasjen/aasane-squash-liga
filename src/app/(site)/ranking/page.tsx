import { asc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { db, schema } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { LEVEL_LABELS } from "@/lib/player-options";
import { getRankingInfo } from "@/lib/ranking-info";

export const metadata: Metadata = { title: "Ranking – Torsdagsligaen" };

export default function RankingPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Ranking</h1>
      <Suspense fallback={<p className="text-zinc-500">Henter ranking …</p>}>
        <Ranking />
      </Suspense>
    </main>
  );
}

async function Ranking() {
  const me = await requirePlayer();
  const info = await getRankingInfo();
  const players = await db
    .select({
      id: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      level: schema.players.level,
      ranking: schema.players.ranking,
    })
    .from(schema.players)
    .where(eq(schema.players.active, true))
    .orderBy(
      sql`${schema.players.ranking} asc nulls last`,
      asc(schema.players.lastName),
      asc(schema.players.firstName),
    );

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
      {info.updatedAt && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Rankingen ble sist oppdatert {formatDateTime(info.updatedAt)}.
        </p>
      )}
      <ol className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {ranked.map((p) => {
          const isMe = p.id === me.id;
          return (
            <li
              key={p.id}
              aria-current={isMe ? "true" : undefined}
              className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? "bg-zinc-100 font-medium dark:bg-zinc-900" : ""}`}
            >
              <span className="w-8 text-right tabular-nums text-zinc-500">{p.ranking}.</span>
              <span className="flex-1">
                {p.firstName} {p.lastName}
                {isMe && <span className="ml-2 text-sm font-normal text-zinc-500">(deg)</span>}
              </span>
              <span className="text-sm text-zinc-500">{p.level ? LEVEL_LABELS[p.level] : ""}</span>
            </li>
          );
        })}
      </ol>

      {info.message && (
        <section className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm whitespace-pre-line dark:border-zinc-800 dark:bg-zinc-900">
          {info.message}
        </section>
      )}

      {unranked.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Ikke rangert ennå</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nye spillere får plass neste gang en admin oppdaterer rankingen.
          </p>
          <ul className="text-zinc-700 dark:text-zinc-300">
            {unranked.map((p) => (
              <li key={p.id} className={p.id === me.id ? "font-medium" : undefined}>
                {p.firstName} {p.lastName}
                {p.id === me.id && <span className="ml-2 text-sm font-normal text-zinc-500">(deg)</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
