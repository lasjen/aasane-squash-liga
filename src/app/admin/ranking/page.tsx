import { and, asc, eq, isNotNull, isNull, count } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { db, schema } from "@/db";
import { requireOperator } from "@/lib/auth/admin-session";
import { LEVEL_LABELS } from "@/lib/player-options";
import { findStartedRound } from "@/lib/rounds";

import { RankingEditor } from "./ranking-editor";

export const metadata: Metadata = { title: "Ranking – Konsoll – Torsdagsligaen" };

export default function AdminRankingPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ranking</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Dra spillerne opp og ned med håndtaket, eller bruk pilene. Ingenting lagres før du
          trykker «Publiser». «Angre» går tilbake til rankingen slik den er publisert.
        </p>
      </div>
      <Suspense fallback={<p className="text-zinc-500">Henter rankingen …</p>}>
        <Ranking />
      </Suspense>
    </main>
  );
}

const noticeClass =
  "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100";

async function Ranking() {
  await requireOperator();

  const [players, [{ unranked }], startedRound] = await Promise.all([
    db
      .select({
        id: schema.players.id,
        firstName: schema.players.firstName,
        lastName: schema.players.lastName,
        level: schema.players.level,
      })
      .from(schema.players)
      .where(and(eq(schema.players.active, true), isNotNull(schema.players.ranking)))
      .orderBy(asc(schema.players.ranking), asc(schema.players.id)),
    db
      .select({ unranked: count() })
      .from(schema.players)
      .where(
        and(
          eq(schema.players.active, true),
          isNull(schema.players.ranking),
          isNull(schema.players.deletedAt),
        ),
      ),
    findStartedRound(),
  ]);

  return (
    <>
      {startedRound && (
        <p className={noticeClass}>
          En runde er i gang, og gruppene er allerede satt opp. Endringer du publiserer nå, blir
          utgangspunktet for den nye rankingen når runden avsluttes.
        </p>
      )}
      {unranked > 0 && (
        <p className={noticeClass}>
          {unranked} {unranked === 1 ? "aktiv spiller har" : "aktive spillere har"} ikke plass i
          rankingen ennå. Trykk «Oppdater ranking» under{" "}
          <Link href="/admin" className="font-medium underline">
            Spillere
          </Link>{" "}
          for å gi dem en plass, så kan du flytte dem her.
        </p>
      )}
      <RankingEditor
        players={players.map((p) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          level: p.level ? LEVEL_LABELS[p.level] : null,
        }))}
      />
      <p className="text-xs text-zinc-500">
        Merk: Rettes resultatene i den sist avsluttede runden etter at du har publisert, regnes
        rankingen ut på nytt fra rankingen før den runden, og endringene du har gjort her blir
        overskrevet.
      </p>
    </>
  );
}
