import "server-only";

import { asc, eq, or, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { poolARanking } from "@/lib/standings";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Henter og låser kampen for resten av transaksjonen. */
export async function lockMatch(tx: Transaction, matchId: number) {
  const [match] = await tx
    .select({
      id: schema.matches.id,
      roundId: schema.matches.roundId,
      groupId: schema.matches.groupId,
      player1Id: schema.matches.player1Id,
      player2Id: schema.matches.player2Id,
      status: schema.matches.status,
      reportedById: schema.matches.reportedById,
      confirmedAt: schema.matches.confirmedAt,
      roundStatus: schema.rounds.status,
      bestOf: schema.rounds.bestOf,
    })
    .from(schema.matches)
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.matches.roundId))
    .where(eq(schema.matches.id, matchId))
    .for("update", { of: schema.matches });
  return match ?? null;
}

/**
 * Lagrer resultatet. `confirmed` betyr at resultatet er endelig (motspiller eller admin);
 * ellers venter det på at motspilleren bekrefter. Kamper som avhenger av denne
 * (vinner mot vinner, taper mot taper) får spillerne fylt inn.
 */
export async function saveResult(
  tx: Transaction,
  match: { id: number; groupId: number; player1Id: number; player2Id: number },
  player1Games: number,
  player2Games: number,
  byPlayerId: number,
  confirmed: boolean,
) {
  const now = new Date();
  await tx
    .update(schema.matches)
    .set({
      status: "played",
      player1Games,
      player2Games,
      winnerId: player1Games > player2Games ? match.player1Id : match.player2Id,
      reportedById: byPlayerId,
      reportedAt: now,
      confirmedById: confirmed ? byPlayerId : null,
      confirmedAt: confirmed ? now : null,
    })
    .where(eq(schema.matches.id, match.id));
  await updateDependentMatches(tx, match.id);
  await updatePoolDependentMatches(tx, match.groupId);
}

/** Motspilleren (eller admin) godtar resultatet som er registrert. */
export async function confirmResult(tx: Transaction, matchId: number, byPlayerId: number) {
  await tx
    .update(schema.matches)
    .set({ confirmedById: byPlayerId, confirmedAt: new Date() })
    .where(eq(schema.matches.id, matchId));
}

const noResult = {
  status: "scheduled" as const,
  player1Games: null,
  player2Games: null,
  winnerId: null,
  reportedById: null,
  reportedAt: null,
  confirmedById: null,
  confirmedAt: null,
};

/**
 * Fyller inn vinner og taper fra kampen i kampene som avhenger av den.
 * Endres en spiller i en kamp som allerede har resultat, nullstilles det resultatet,
 * siden det gjaldt andre spillere.
 */
async function updateDependentMatches(tx: Transaction, sourceMatchId: number) {
  const [source] = await tx
    .select({
      player1Id: schema.matches.player1Id,
      player2Id: schema.matches.player2Id,
      winnerId: schema.matches.winnerId,
    })
    .from(schema.matches)
    .where(eq(schema.matches.id, sourceMatchId));
  if (!source) return;

  const loserId =
    source.winnerId === null
      ? null
      : source.winnerId === source.player1Id
        ? source.player2Id
        : source.player1Id;
  const pick = (result: "winner" | "loser" | null) =>
    result === "winner" ? source.winnerId : result === "loser" ? loserId : null;

  const dependents = await tx
    .select({
      id: schema.matches.id,
      player1Id: schema.matches.player1Id,
      player2Id: schema.matches.player2Id,
      player1SourceMatchId: schema.matches.player1SourceMatchId,
      player1SourceResult: schema.matches.player1SourceResult,
      player2SourceMatchId: schema.matches.player2SourceMatchId,
      player2SourceResult: schema.matches.player2SourceResult,
      status: schema.matches.status,
    })
    .from(schema.matches)
    .where(
      or(
        eq(schema.matches.player1SourceMatchId, sourceMatchId),
        eq(schema.matches.player2SourceMatchId, sourceMatchId),
      ),
    );

  for (const d of dependents) {
    const player1Id = d.player1SourceMatchId === sourceMatchId ? pick(d.player1SourceResult) : d.player1Id;
    const player2Id = d.player2SourceMatchId === sourceMatchId ? pick(d.player2SourceResult) : d.player2Id;
    if (player1Id === d.player1Id && player2Id === d.player2Id) continue;

    await tx
      .update(schema.matches)
      .set({ player1Id, player2Id, ...(d.status !== "scheduled" && noResult) })
      .where(eq(schema.matches.id, d.id));
    await updateDependentMatches(tx, d.id);
  }
}

/**
 * I grupper på 5: fyller inn nr. 1 og 2 i pulje A i kampene om 1. og 3. plass når alle
 * A-kampene har resultat, og tømmer plassene hvis pulje A ikke lenger er ferdig.
 * Endres en spiller i en kamp som har resultat, nullstilles det resultatet.
 */
async function updatePoolDependentMatches(tx: Transaction, groupId: number) {
  const matches = await tx
    .select({
      id: schema.matches.id,
      number: schema.matches.number,
      pool: schema.matches.pool,
      player1Id: schema.matches.player1Id,
      player2Id: schema.matches.player2Id,
      player1Games: schema.matches.player1Games,
      player2Games: schema.matches.player2Games,
      winnerId: schema.matches.winnerId,
      player1SourcePoolRank: schema.matches.player1SourcePoolRank,
      player2SourcePoolRank: schema.matches.player2SourcePoolRank,
      status: schema.matches.status,
    })
    .from(schema.matches)
    .where(eq(schema.matches.groupId, groupId));
  const dependents = matches.filter(
    (m) => m.player1SourcePoolRank !== null || m.player2SourcePoolRank !== null,
  );
  if (dependents.length === 0) return;

  // Seed-rekkefølgen i gruppen, samme som kampoppsettet bruker.
  const seeds = await tx
    .select({ id: schema.players.id })
    .from(schema.roundGroupPlayers)
    .innerJoin(schema.players, eq(schema.players.id, schema.roundGroupPlayers.playerId))
    .where(eq(schema.roundGroupPlayers.groupId, groupId))
    .orderBy(
      sql`${schema.players.ranking} asc nulls last`,
      asc(schema.players.lastName),
      asc(schema.players.firstName),
    );
  const ranking = poolARanking(
    seeds.map((p) => p.id),
    matches,
  );
  const pick = (rank: number | null, current: number | null) =>
    rank === null ? current : (ranking?.[rank - 1] ?? null);

  for (const d of dependents) {
    const player1Id = pick(d.player1SourcePoolRank, d.player1Id);
    const player2Id = pick(d.player2SourcePoolRank, d.player2Id);
    if (player1Id === d.player1Id && player2Id === d.player2Id) continue;

    await tx
      .update(schema.matches)
      .set({ player1Id, player2Id, ...(d.status !== "scheduled" && noResult) })
      .where(eq(schema.matches.id, d.id));
    await updateDependentMatches(tx, d.id);
  }
}
