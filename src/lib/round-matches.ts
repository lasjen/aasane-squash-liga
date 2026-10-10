import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db, schema } from "@/db";
import { isPoolSource, planGroupMatches, type Source } from "@/lib/match-plan";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Setter opp kampene i en gruppe på nytt ut fra hvem som er i gruppen nå.
 * Spillerne nummereres etter ranking (beste først, uten ranking sist).
 * Brukes når runden startes eller restartes, og når admin endrer gruppen.
 */
export async function regenerateGroupMatches(tx: Transaction, roundId: number, groupId: number) {
  await tx.delete(schema.matches).where(eq(schema.matches.groupId, groupId));

  const players = await tx
    .select({ id: schema.players.id })
    .from(schema.roundGroupPlayers)
    .innerJoin(schema.players, eq(schema.players.id, schema.roundGroupPlayers.playerId))
    .where(eq(schema.roundGroupPlayers.groupId, groupId))
    .orderBy(
      sql`${schema.players.ranking} asc nulls last`,
      asc(schema.players.lastName),
      asc(schema.players.firstName),
    );

  // Kampene settes inn i rekkefølge, så kampene som avhenger av tidligere kamper
  // kan peke på dem med id.
  const idByNumber = new Map<number, number>();
  const slot = (value: number | Source) =>
    typeof value === "number"
      ? { playerId: value, sourceMatchId: null, sourceResult: null, sourcePoolRank: null }
      : isPoolSource(value)
        ? { playerId: null, sourceMatchId: null, sourceResult: null, sourcePoolRank: value.rank }
        : {
            playerId: null,
            sourceMatchId: idByNumber.get(value.match)!,
            sourceResult: value.result,
            sourcePoolRank: null,
          };

  for (const match of planGroupMatches(players.map((p) => p.id))) {
    const p1 = slot(match.player1);
    const p2 = slot(match.player2);
    const [created] = await tx
      .insert(schema.matches)
      .values({
        roundId,
        groupId,
        number: match.number,
        pool: match.pool ?? null,
        player1Id: p1.playerId,
        player1SourceMatchId: p1.sourceMatchId,
        player1SourceResult: p1.sourceResult,
        player1SourcePoolRank: p1.sourcePoolRank,
        player2Id: p2.playerId,
        player2SourceMatchId: p2.sourceMatchId,
        player2SourceResult: p2.sourceResult,
        player2SourcePoolRank: p2.sourcePoolRank,
      })
      .returning({ id: schema.matches.id });
    idByNumber.set(match.number, created.id);
  }
}

const player1 = alias(schema.players, "player1");
const player2 = alias(schema.players, "player2");
const source1 = alias(schema.matches, "source1");
const source2 = alias(schema.matches, "source2");

export type MatchSide =
  | { kind: "player"; id: number; name: string }
  | { kind: "source"; source: Source };

export type RoundMatch = {
  id: number;
  groupId: number;
  number: number;
  /** Pulje i grupper på 5 ("A" eller "B"), ellers null. */
  pool: string | null;
  player1: MatchSide;
  player2: MatchSide;
  status: (typeof schema.matchStatus.enumValues)[number];
  winnerId: number | null;
  player1Games: number | null;
  player2Games: number | null;
  reportedById: number | null;
  /** Resultatet er registrert, men ikke bekreftet av motspilleren eller en admin. */
  awaitingConfirmation: boolean;
};

/** Alle kampene i runden, sortert etter gruppe og kampnummer. */
export async function getRoundMatches(roundId: number): Promise<RoundMatch[]> {
  const rows = await db
    .select({
      id: schema.matches.id,
      groupId: schema.matches.groupId,
      number: schema.matches.number,
      pool: schema.matches.pool,
      source1PoolRank: schema.matches.player1SourcePoolRank,
      source2PoolRank: schema.matches.player2SourcePoolRank,
      status: schema.matches.status,
      winnerId: schema.matches.winnerId,
      player1Games: schema.matches.player1Games,
      player2Games: schema.matches.player2Games,
      reportedById: schema.matches.reportedById,
      confirmedAt: schema.matches.confirmedAt,
      player1Id: player1.id,
      player1First: player1.firstName,
      player1Last: player1.lastName,
      player2Id: player2.id,
      player2First: player2.firstName,
      player2Last: player2.lastName,
      source1Number: source1.number,
      source1Result: schema.matches.player1SourceResult,
      source2Number: source2.number,
      source2Result: schema.matches.player2SourceResult,
    })
    .from(schema.matches)
    .leftJoin(player1, eq(player1.id, schema.matches.player1Id))
    .leftJoin(player2, eq(player2.id, schema.matches.player2Id))
    .leftJoin(source1, eq(source1.id, schema.matches.player1SourceMatchId))
    .leftJoin(source2, eq(source2.id, schema.matches.player2SourceMatchId))
    .where(eq(schema.matches.roundId, roundId))
    .orderBy(asc(schema.matches.groupId), asc(schema.matches.number));

  const side = (
    id: number | null,
    first: string | null,
    last: string | null,
    sourceNumber: number | null,
    sourceResult: "winner" | "loser" | null,
    poolRank: number | null,
  ): MatchSide =>
    id !== null
      ? { kind: "player", id, name: `${first} ${last}` }
      : poolRank !== null
        ? { kind: "source", source: { pool: "A", rank: poolRank as 1 | 2 } }
        : { kind: "source", source: { match: sourceNumber!, result: sourceResult! } };

  return rows.map((r) => ({
    id: r.id,
    groupId: r.groupId,
    number: r.number,
    pool: r.pool,
    status: r.status,
    winnerId: r.winnerId,
    player1Games: r.player1Games,
    player2Games: r.player2Games,
    reportedById: r.reportedById,
    awaitingConfirmation: r.status === "played" && r.confirmedAt === null,
    player1: side(r.player1Id, r.player1First, r.player1Last, r.source1Number, r.source1Result, r.source1PoolRank),
    player2: side(r.player2Id, r.player2First, r.player2Last, r.source2Number, r.source2Result, r.source2PoolRank),
  }));
}
