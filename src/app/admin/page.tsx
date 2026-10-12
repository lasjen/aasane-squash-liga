import { asc, desc, isNull, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { db, schema } from "@/db";
import { requireOperator } from "@/lib/auth/admin-session";
import { GENDER_LABELS, LEVEL_LABELS } from "@/lib/player-options";
import { ROLE_LABELS } from "@/lib/roles";

import {
  ActivatePlayerButton,
  DeactivatePlayerButton,
  DeletePlayerButton,
  UpdateRankingButton,
} from "./player-buttons";

export const metadata: Metadata = { title: "Admin – Torsdagsligaen" };

/** Faste meldinger etter en handling. Bare kjente nøkler vises, aldri tekst fra URL-en. */
const MESSAGES: Record<string, (params: Record<string, string | string[] | undefined>) => string> = {
  "lagt-til": () => "Spilleren er lagt til.",
  lagret: () => "Endringene er lagret.",
  deaktivert: () => "Spilleren er satt på pause og tatt ut av rankingen.",
  aktivert: () =>
    "Spilleren er aktiv igjen. Trykk «Oppdater ranking» for å gi spilleren en plass i rankingen.",
  "ikke-deg-selv": () => "Du kan ikke sette deg selv på pause.",
  "spiller-slettet": () =>
    "Spilleren er slettet. Tidligere kamper og resultater vises nå som «Tidligere spiller».",
  "i-runde": () =>
    "Spilleren er med i en runde som pågår. Fjern spilleren fra runden under Ligarunde før du sletter.",
  "ikke-slette-deg-selv": () => "Du kan ikke slette deg selv.",
  "kun-admin": () => "Det kan bare en admin gjøre.",
  "siste-admin": () => "Spilleren er den siste admin-en, og kan ikke slettes.",
  ranking: (params) => {
    const count = Number(params.nye) || 0;
    return count === 0
      ? "Rankingen er oppdatert. Alle aktive spillere hadde allerede en plass."
      : `Rankingen er oppdatert. ${count} ${count === 1 ? "spiller" : "spillere"} fikk ny plass.`;
  },
};

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Spillere</h1>
      <Suspense fallback={<p className="text-zinc-500">Henter spillere …</p>}>
        <AdminPlayers searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AdminPlayers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOperator();
  const params = await searchParams;
  const key = typeof params.melding === "string" ? params.melding : undefined;
  const message = key && MESSAGES[key]?.(params);

  return (
    <>
      {message && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
        >
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/spillere/ny"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Legg til ny spiller
        </Link>
        <UpdateRankingButton />
      </div>
      <PlayerTable />
    </>
  );
}

async function PlayerTable() {

  const players = await db
    .select({
      id: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      email: schema.players.email,
      phone: schema.players.phone,
      gender: schema.players.gender,
      level: schema.players.level,
      active: schema.players.active,
      isMember: schema.players.isMember,
      role: schema.players.role,
      ranking: schema.players.ranking,
    })
    .from(schema.players)
    // Slettede spillere vises ikke.
    .where(isNull(schema.players.deletedAt))
    // Rangerte først, deretter aktive uten ranking, til slutt inaktive.
    .orderBy(
      desc(schema.players.active),
      sql`${schema.players.ranking} asc nulls last`,
      asc(schema.players.lastName),
      asc(schema.players.firstName),
    );

  if (players.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">Ingen spillere er registrert ennå.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2 text-right font-medium">#</th>
            <th className="px-3 py-2 font-medium">Navn</th>
            <th className="px-3 py-2 font-medium">E-post</th>
            <th className="px-3 py-2 font-medium">Mobil</th>
            <th className="px-3 py-2 font-medium">Kjønn</th>
            <th className="px-3 py-2 font-medium">Nivå</th>
            <th className="px-3 py-2 font-medium">Medlem</th>
            <th className="px-3 py-2">
              <span className="sr-only">Handlinger</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {players.map((p) => (
            <tr key={p.id} className={p.active ? undefined : "text-zinc-400"}>
              <td className="px-3 py-2 text-right tabular-nums">{p.ranking ?? "–"}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {p.firstName} {p.lastName}
                {p.role !== "player" && (
                  <span className="ml-2 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
                    {ROLE_LABELS[p.role].toLowerCase()}
                  </span>
                )}
                {!p.active && <span className="ml-2 text-xs">(på pause)</span>}
              </td>
              <td className="px-3 py-2">{p.email ?? "–"}</td>
              <td className="px-3 py-2 whitespace-nowrap">{p.phone ?? "–"}</td>
              <td className="px-3 py-2">{p.gender ? GENDER_LABELS[p.gender] : "–"}</td>
              <td className="px-3 py-2">{p.level ? LEVEL_LABELS[p.level] : "–"}</td>
              <td className="px-3 py-2">
                {p.isMember ? (
                  "Ja"
                ) : (
                  <span className="font-medium text-amber-700 dark:text-amber-400">Ikke sjekket</span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-3 text-zinc-900 dark:text-zinc-100">
                  <Link href={`/admin/spillere/${p.id}/endre`} className="font-medium underline">
                    Endre
                  </Link>
                  {p.active ? (
                    <DeactivatePlayerButton playerId={p.id} name={p.firstName} />
                  ) : (
                    <ActivatePlayerButton playerId={p.id} />
                  )}
                  <DeletePlayerButton playerId={p.id} name={`${p.firstName} ${p.lastName}`} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
