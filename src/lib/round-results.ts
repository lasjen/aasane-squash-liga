import "server-only";

import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { isWomensLeagueMember, LEAGUES, type League } from "@/lib/leagues";
import { touchRanking } from "@/lib/ranking-info";
import { groupStandings, newRankingKeeping, resultOrder } from "@/lib/standings";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Spillernes plass i en liga før runden, som id-er fra plass 1 og nedover. */
type Snapshot = { playerId: number; ranking: number }[];

/**
 * Lager resultatlistene for runden og oppdaterer rankingene. Kalles når runden avsluttes,
 * og på nytt når admin retter et resultat i runden etterpå. Utregningen starter alltid
 * fra rankingen før runden, så den gir samme svar uansett hvor mange ganger den kjøres.
 * Se src/lib/standings.ts for reglene.
 *
 * Har runden damegrupper, får dameligaen sin egen resultatliste og ranking. Kvinnene som
 * spilte dameliga, beholder plassen sin i «Alle»-rankingen.
 */
export async function saveRoundResults(tx: Transaction, roundId: number) {
  const members = await tx
    .select({
      groupId: schema.roundGroups.id,
      league: schema.roundGroups.league,
      groupNumber: schema.roundGroups.number,
      playerId: schema.players.id,
    })
    .from(schema.roundGroups)
    .innerJoin(schema.roundGroupPlayers, eq(schema.roundGroupPlayers.groupId, schema.roundGroups.id))
    .innerJoin(schema.players, eq(schema.players.id, schema.roundGroupPlayers.playerId))
    .where(eq(schema.roundGroups.roundId, roundId))
    // Samme seed-rekkefølge som kampoppsettet bruker (se regenerateGroupMatches).
    .orderBy(
      asc(schema.roundGroups.league),
      asc(schema.roundGroups.number),
      sql`case when ${schema.roundGroups.league} = 'women' then ${schema.players.womenRanking} end asc nulls last`,
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

  /** Resultatlisten for ligaen: sluttstilling per gruppe, i gruppenummer-rekkefølge. */
  const resultsFor = (league: League) => {
    const inLeague = members.filter((m) => m.league === league);
    const groupIds = [...new Map(inLeague.map((m) => [m.groupNumber, m.groupId])).entries()].sort(
      ([a], [b]) => a - b,
    );
    const standings = groupIds.map(([groupNumber, groupId]) =>
      groupStandings(
        inLeague.filter((m) => m.groupId === groupId).map((m) => m.playerId),
        matches.filter((m) => m.groupId === groupId),
      ).map((standing, i) => ({ ...standing, groupNumber, groupPosition: i + 1 })),
    );
    return resultOrder(standings);
  };
  const openResults = resultsFor("open");
  const womenResults = resultsFor("women");

  // Låser spillerradene så ingen andre endrer rankingen samtidig.
  const players = await tx
    .select({
      id: schema.players.id,
      ranking: schema.players.ranking,
      womenRanking: schema.players.womenRanking,
      active: schema.players.active,
      gender: schema.players.gender,
      wantsWomensLeague: schema.players.wantsWomensLeague,
      deletedAt: schema.players.deletedAt,
    })
    .from(schema.players)
    .for("update");
  const active = new Set(players.filter((p) => p.active).map((p) => p.id));
  const womenMembers = new Set(players.filter(isWomensLeagueMember).map((p) => p.id));

  // Rankingen før runden. Første gang runden avsluttes, er det dagens ranking, og den lagres
  // så utregningen kan gjøres på nytt hvis et resultat rettes senere.
  const stored = await tx
    .select({
      league: schema.roundRankingSnapshots.league,
      playerId: schema.roundRankingSnapshots.playerId,
      ranking: schema.roundRankingSnapshots.ranking,
    })
    .from(schema.roundRankingSnapshots)
    .where(eq(schema.roundRankingSnapshots.roundId, roundId))
    .orderBy(asc(schema.roundRankingSnapshots.ranking));
  const current = (key: "ranking" | "womenRanking"): Snapshot =>
    players
      .filter((p) => p.active && p[key] !== null)
      .map((p) => ({ playerId: p.id, ranking: p[key]! }))
      .sort((a, b) => a.ranking - b.ranking);
  // Runder som ble avsluttet før dameligaen fantes, har bare «Alle» lagret.
  const snapshots: Record<League, Snapshot> =
    stored.length > 0
      ? {
          open: stored.filter((x) => x.league === "open"),
          women: stored.filter((x) => x.league === "women"),
        }
      : { open: current("ranking"), women: current("womenRanking") };
  if (stored.length === 0) {
    const rows = LEAGUES.flatMap((league) => snapshots[league].map((x) => ({ roundId, league, ...x })));
    if (rows.length > 0) await tx.insert(schema.roundRankingSnapshots).values(rows);
  }

  /**
   * Ny ranking for ligaen. Utgangspunktet er rankingen før runden, uten spillere som ikke
   * lenger hører til ligaen, pluss spillere som har fått plass etterpå (nederst, i dagens
   * rekkefølge). `kept` beholder plassen sin.
   */
  const rankLeague = (
    snapshot: Snapshot,
    key: "ranking" | "womenRanking",
    belongs: (id: number) => boolean,
    results: number[],
    kept = new Set<number>(),
  ) => {
    const participants = new Set(results);
    const inSnapshot = new Set(snapshot.map((x) => x.playerId));
    const ranked = [
      ...snapshot.map((x) => x.playerId).filter(belongs),
      ...players
        .filter((p) => belongs(p.id) && p[key] !== null && !inSnapshot.has(p.id) && !participants.has(p.id))
        .sort((a, b) => a[key]! - b[key]!)
        .map((p) => p.id),
    ];
    return newRankingKeeping(ranked, results.filter(belongs), kept);
  };

  const before: Record<League, Map<number, number>> = {
    open: new Map(snapshots.open.map((x) => [x.playerId, x.ranking])),
    women: new Map(snapshots.women.map((x) => [x.playerId, x.ranking])),
  };
  const after: Record<League, Map<number, number>> = { open: new Map(), women: new Map() };

  const isActive = (id: number) => active.has(id);
  const openOrder = rankLeague(
    snapshots.open,
    "ranking",
    isActive,
    openResults.map((r) => r.playerId),
    new Set(womenResults.map((r) => r.playerId)),
  );
  after.open = new Map(openOrder.map((id, i) => [id, i + 1]));
  if (openOrder.length > 0) {
    await setRanking(tx, "ranking", openOrder);
    await touchRanking(tx, "open");
  }

  // Dameligaens ranking endres bare i runder med damegrupper.
  if (womenResults.length > 0) {
    const womenOrder = rankLeague(
      snapshots.women,
      "womenRanking",
      (id) => womenMembers.has(id),
      womenResults.map((r) => r.playerId),
    );
    after.women = new Map(womenOrder.map((id, i) => [id, i + 1]));
    if (womenOrder.length > 0) {
      await setRanking(tx, "womenRanking", womenOrder);
      await touchRanking(tx, "women");
    }
  }

  await tx.delete(schema.roundResults).where(eq(schema.roundResults.roundId, roundId));
  const rows = (league: League, results: typeof openResults) =>
    results.map((r, i) => ({
      roundId,
      league,
      playerId: r.playerId,
      position: i + 1,
      groupNumber: r.groupNumber,
      groupPosition: r.groupPosition,
      wins: r.wins,
      losses: r.losses,
      setsWon: r.setsWon,
      setsLost: r.setsLost,
      rankingBefore: before[league].get(r.playerId) ?? null,
      rankingAfter: after[league].get(r.playerId) ?? null,
    }));
  const resultRows = [...rows("open", openResults), ...rows("women", womenResults)];
  if (resultRows.length > 0) await tx.insert(schema.roundResults).values(resultRows);
}

/** Gir spillerne i `order` plass 1, 2, 3 … i rankingen (`ranking` eller `womenRanking`). */
async function setRanking(tx: Transaction, key: "ranking" | "womenRanking", order: number[]) {
  const column = key === "womenRanking" ? sql.raw("women_ranking") : sql.raw("ranking");
  await tx.execute(sql`
    UPDATE ${schema.players} AS p
    SET ${column} = v.ranking
    FROM unnest(${sql.param(order)}::int[]) WITH ORDINALITY AS v(id, ranking)
    WHERE p.id = v.id
  `);
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
