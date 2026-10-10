import "server-only";

import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { groupStandings, newRanking, resultOrder } from "@/lib/standings";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Lager resultatlisten for runden og oppdaterer rankingen. Kalles når runden avsluttes,
 * og på nytt når admin retter et resultat i runden etterpå. Utregningen starter alltid
 * fra rankingen før runden, så den gir samme svar uansett hvor mange ganger den kjøres.
 * Se src/lib/standings.ts for reglene.
 */
export async function saveRoundResults(tx: Transaction, roundId: number) {
  const members = await tx
    .select({
      groupId: schema.roundGroups.id,
      groupNumber: schema.roundGroups.number,
      playerId: schema.players.id,
    })
    .from(schema.roundGroups)
    .innerJoin(schema.roundGroupPlayers, eq(schema.roundGroupPlayers.groupId, schema.roundGroups.id))
    .innerJoin(schema.players, eq(schema.players.id, schema.roundGroupPlayers.playerId))
    .where(eq(schema.roundGroups.roundId, roundId))
    // Samme seed-rekkefølge som kampoppsettet bruker.
    .orderBy(
      asc(schema.roundGroups.number),
      sql`${schema.players.ranking} asc nulls last`,
      asc(schema.players.lastName),
      asc(schema.players.firstName),
    );

  const matches = await tx
    .select({
      groupId: schema.matches.groupId,
      number: schema.matches.number,
      pool: schema.matches.pool,
      player1Id: schema.matches.player1Id,
      player2Id: schema.matches.player2Id,
      player1Games: schema.matches.player1Games,
      player2Games: schema.matches.player2Games,
      winnerId: schema.matches.winnerId,
    })
    .from(schema.matches)
    .where(eq(schema.matches.roundId, roundId));

  // Sluttstilling per gruppe, i gruppenummer-rekkefølge.
  const groupIds = [...new Map(members.map((m) => [m.groupNumber, m.groupId])).entries()].sort(
    ([a], [b]) => a - b,
  );
  const standings = groupIds.map(([groupNumber, groupId]) =>
    groupStandings(
      members.filter((m) => m.groupId === groupId).map((m) => m.playerId),
      matches.filter((m) => m.groupId === groupId),
    ).map((standing, i) => ({ ...standing, groupNumber, groupPosition: i + 1 })),
  );
  const results = resultOrder(standings);

  // Låser spillerradene så ingen andre endrer rankingen samtidig.
  const players = await tx
    .select({ id: schema.players.id, ranking: schema.players.ranking, active: schema.players.active })
    .from(schema.players)
    .for("update");
  const active = new Set(players.filter((p) => p.active).map((p) => p.id));
  const participants = new Set(results.map((r) => r.playerId));

  // Rankingen før runden. Første gang runden avsluttes, er det dagens ranking, og den lagres
  // så utregningen kan gjøres på nytt hvis et resultat rettes senere.
  let snapshot = await tx
    .select({ playerId: schema.roundRankingSnapshots.playerId, ranking: schema.roundRankingSnapshots.ranking })
    .from(schema.roundRankingSnapshots)
    .where(eq(schema.roundRankingSnapshots.roundId, roundId))
    .orderBy(asc(schema.roundRankingSnapshots.ranking));
  if (snapshot.length === 0) {
    snapshot = players
      .filter((p) => p.active && p.ranking !== null)
      .map((p) => ({ playerId: p.id, ranking: p.ranking! }))
      .sort((a, b) => a.ranking - b.ranking);
    if (snapshot.length > 0) {
      await tx.insert(schema.roundRankingSnapshots).values(snapshot.map((x) => ({ roundId, ...x })));
    }
  }
  const before = new Map(snapshot.map((x) => [x.playerId, x.ranking]));

  // Utgangspunktet: rankingen før runden, uten spillere som er satt på pause siden,
  // pluss spillere som har fått ranking etterpå (de legges nederst i dagens rekkefølge).
  const inSnapshot = new Set(snapshot.map((x) => x.playerId));
  const ranked = [
    ...snapshot.map((x) => x.playerId).filter((id) => active.has(id)),
    ...players
      .filter((p) => p.active && p.ranking !== null && !inSnapshot.has(p.id) && !participants.has(p.id))
      .sort((a, b) => a.ranking! - b.ranking!)
      .map((p) => p.id),
  ];
  const order = newRanking(
    ranked,
    results.map((r) => r.playerId).filter((id) => active.has(id)),
  );
  const after = new Map(order.map((id, i) => [id, i + 1]));

  if (order.length > 0) {
    await tx.execute(sql`
      UPDATE ${schema.players} AS p
      SET ranking = v.ranking
      FROM unnest(${sql.param(order)}::int[]) WITH ORDINALITY AS v(id, ranking)
      WHERE p.id = v.id
    `);
  }

  await tx.delete(schema.roundResults).where(eq(schema.roundResults.roundId, roundId));
  if (results.length > 0) {
    await tx.insert(schema.roundResults).values(
      results.map((r, i) => ({
        roundId,
        playerId: r.playerId,
        position: i + 1,
        groupNumber: r.groupNumber,
        groupPosition: r.groupPosition,
        wins: r.wins,
        losses: r.losses,
        setsWon: r.setsWon,
        setsLost: r.setsLost,
        rankingBefore: before.get(r.playerId) ?? null,
        rankingAfter: after.get(r.playerId) ?? null,
      })),
    );
  }
}

/**
 * Hvorfor en avsluttet runde ikke kan endres, eller null hvis den kan det.
 * Bare den sist avsluttede runden kan endres, og ikke mens en annen runde er i gang,
 * ellers ville rankingen til senere runder bygge på feil grunnlag.
 */
export async function finishedRoundEditProblem(
  executor: typeof db | Transaction,
  roundId: number,
): Promise<string | null> {
  const rounds = await executor
    .select({ id: schema.rounds.id, status: schema.rounds.status, playedOn: schema.rounds.playedOn })
    .from(schema.rounds)
    .where(inArray(schema.rounds.status, ["started", "finished"]));

  const round = rounds.find((r) => r.id === roundId);
  if (!round || round.status !== "finished") return "Runden er ikke avsluttet.";
  if (rounds.some((r) => r.status === "started")) {
    return "En runde er i gang. Resultater i avsluttede runder kan ikke endres før den er avsluttet.";
  }
  if (rounds.some((r) => r.status === "finished" && r.playedOn > round.playedOn)) {
    return "Bare den sist avsluttede runden kan endres, fordi rankingen etter senere runder bygger på den.";
  }
  return null;
}

/** Antall kamper i runden som mangler resultat. */
export async function countMissingResults(executor: typeof db | Transaction, roundId: number) {
  const [{ missing }] = await executor
    .select({ missing: count() })
    .from(schema.matches)
    .where(and(eq(schema.matches.roundId, roundId), isNull(schema.matches.player1Games)));
  return missing;
}
