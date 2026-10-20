import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";

import { db, schema } from "@/db";

/** Alle avsluttede runder, nyeste først, med antall deltakere. */
export async function getFinishedRounds() {
  return db
    .select({
      id: schema.rounds.id,
      number: schema.rounds.number,
      playedOn: schema.rounds.playedOn,
      bestOf: schema.rounds.bestOf,
      season: schema.seasons.name,
      participants: count(schema.roundResults.playerId),
    })
    .from(schema.rounds)
    .innerJoin(schema.seasons, eq(schema.seasons.id, schema.rounds.seasonId))
    .leftJoin(schema.roundResults, eq(schema.roundResults.roundId, schema.rounds.id))
    .where(eq(schema.rounds.status, "finished"))
    .groupBy(schema.rounds.id, schema.seasons.name)
    .orderBy(desc(schema.rounds.playedOn));
}

/** En avsluttet runde med resultatlisten, eller null hvis runden ikke finnes eller ikke er avsluttet. */
export async function getFinishedRound(roundId: number) {
  const [round] = await db
    .select({
      id: schema.rounds.id,
      number: schema.rounds.number,
      playedOn: schema.rounds.playedOn,
      bestOf: schema.rounds.bestOf,
      season: schema.seasons.name,
    })
    .from(schema.rounds)
    .innerJoin(schema.seasons, eq(schema.seasons.id, schema.rounds.seasonId))
    .where(and(eq(schema.rounds.id, roundId), eq(schema.rounds.status, "finished")));
  if (!round) return null;

  const results = await db
    .select({
      playerId: schema.roundResults.playerId,
      league: schema.roundResults.league,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      position: schema.roundResults.position,
      groupNumber: schema.roundResults.groupNumber,
      groupPosition: schema.roundResults.groupPosition,
      wins: schema.roundResults.wins,
      losses: schema.roundResults.losses,
      setsWon: schema.roundResults.setsWon,
      setsLost: schema.roundResults.setsLost,
      rankingBefore: schema.roundResults.rankingBefore,
      rankingAfter: schema.roundResults.rankingAfter,
    })
    .from(schema.roundResults)
    .innerJoin(schema.players, eq(schema.players.id, schema.roundResults.playerId))
    .where(eq(schema.roundResults.roundId, roundId))
    .orderBy(asc(schema.roundResults.league), asc(schema.roundResults.position));

  return { ...round, results };
}
