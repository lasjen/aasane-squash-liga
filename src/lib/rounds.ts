import "server-only";

import { and, asc, desc, eq, gte, isNull, lte, max, or, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { addDays, osloToday, seasonFor, thursdayOnOrAfter } from "@/lib/dates";

type Db = typeof db;
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Neste runde spillerne kan melde seg på: førstkommende torsdag (i dag, hvis det er torsdag),
 * eller torsdagen etter hvis admin allerede har startet den runden.
 * `round` er null hvis ingen har meldt seg på ennå, for runden lages først ved første påmelding.
 */
export async function findNextRound(now: Date = new Date()) {
  let date = thursdayOnOrAfter(osloToday(now));

  // To runder holder: er denne ukens runde startet, er neste ukes runde garantert ikke det.
  for (let i = 0; i < 2; i++) {
    const [round] = await db
      .select({
        id: schema.rounds.id,
        number: schema.rounds.number,
        status: schema.rounds.status,
        bestOf: schema.rounds.bestOf,
      })
      .from(schema.rounds)
      .where(eq(schema.rounds.playedOn, date))
      .limit(1);
    if (!round || round.status === "open") return { date, round: round ?? null };
    date = addDays(date, 7);
  }
  return { date, round: null };
}

/**
 * Runden admin har startet, og som ikke er ferdig ennå. Er det flere, den nyeste.
 * Liga-fanen vises bare når denne finnes.
 */
export async function findStartedRound() {
  const [round] = await db
    .select({
      id: schema.rounds.id,
      number: schema.rounds.number,
      playedOn: schema.rounds.playedOn,
      bestOf: schema.rounds.bestOf,
    })
    .from(schema.rounds)
    .where(eq(schema.rounds.status, "started"))
    .orderBy(desc(schema.rounds.playedOn))
    .limit(1);
  return round ?? null;
}

/** Første side etter innlogging: Liga når en runde er i gang, ellers påmeldingen. */
export async function playerHomePath() {
  return (await findStartedRound()) ? "/liga" : "/pamelding";
}

/** Sesongen som dekker datoen. Finnes ingen, lages «Vår ÅÅÅÅ» eller «Høst ÅÅÅÅ». */
async function ensureSeason(tx: Transaction, date: string) {
  const [existing] = await tx
    .select({ id: schema.seasons.id })
    .from(schema.seasons)
    .where(
      and(
        lte(schema.seasons.startsOn, date),
        or(isNull(schema.seasons.endsOn), gte(schema.seasons.endsOn, date)),
      ),
    )
    .orderBy(asc(schema.seasons.startsOn))
    .limit(1);
  if (existing) return existing.id;

  const season = seasonFor(date);
  await tx.insert(schema.seasons).values(season).onConflictDoNothing({ target: schema.seasons.name });
  const [created] = await tx
    .select({ id: schema.seasons.id })
    .from(schema.seasons)
    .where(eq(schema.seasons.name, season.name));
  return created.id;
}

/**
 * Runden på datoen. Lages hvis den ikke finnes, med neste rundenummer i sesongen.
 * Tåler at to spillere melder seg på samtidig: den ene lager runden, den andre finner den.
 */
export async function ensureRound(tx: Transaction, date: string) {
  const seasonId = await ensureSeason(tx, date);

  const [existing] = await tx
    .select({ id: schema.rounds.id, status: schema.rounds.status })
    .from(schema.rounds)
    .where(and(eq(schema.rounds.seasonId, seasonId), eq(schema.rounds.playedOn, date)));
  if (existing) return existing;

  const [{ last }] = await tx
    .select({ last: max(schema.rounds.number) })
    .from(schema.rounds)
    .where(eq(schema.rounds.seasonId, seasonId));
  const [created] = await tx
    .insert(schema.rounds)
    .values({ seasonId, number: (last ?? 0) + 1, playedOn: date })
    .onConflictDoNothing()
    .returning({ id: schema.rounds.id, status: schema.rounds.status });
  if (created) return created;

  // En annen forespørsel rakk å lage runden først.
  const [raced] = await tx
    .select({ id: schema.rounds.id, status: schema.rounds.status })
    .from(schema.rounds)
    .where(and(eq(schema.rounds.seasonId, seasonId), eq(schema.rounds.playedOn, date)));
  if (!raced) throw new Error(`Kunne ikke opprette runde for ${date}.`);
  return raced;
}

/** Påmeldte spillere i rekkefølgen de meldte seg på. */
export async function getSignups(roundId: number) {
  return db
    .select({
      playerId: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      level: schema.players.level,
      ranking: schema.players.ranking,
    })
    .from(schema.roundSignups)
    .innerJoin(schema.players, eq(schema.players.id, schema.roundSignups.playerId))
    .where(eq(schema.roundSignups.roundId, roundId))
    .orderBy(asc(schema.roundSignups.createdAt));
}

/**
 * Runden admin jobber med: en startet runde hvis det finnes en, ellers neste runde
 * med åpen påmelding. `round` er null hvis neste runde ikke er opprettet ennå.
 */
export async function findAdminRound() {
  const started = await findStartedRound();
  if (started) {
    return {
      date: started.playedOn,
      round: { id: started.id, number: started.number, status: "started" as const, bestOf: started.bestOf },
    };
  }
  return findNextRound();
}

/** Gruppene i runden med spillerne sortert etter ranking. */
export async function getGroups(roundId: number) {
  const rows = await db
    .select({
      groupId: schema.roundGroups.id,
      number: schema.roundGroups.number,
      playerId: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      ranking: schema.players.ranking,
    })
    .from(schema.roundGroups)
    .leftJoin(schema.roundGroupPlayers, eq(schema.roundGroupPlayers.groupId, schema.roundGroups.id))
    .leftJoin(schema.players, eq(schema.players.id, schema.roundGroupPlayers.playerId))
    .where(eq(schema.roundGroups.roundId, roundId))
    .orderBy(
      asc(schema.roundGroups.number),
      sql`${schema.players.ranking} asc nulls last`,
      asc(schema.players.lastName),
    );

  const groups = new Map<number, { id: number; number: number; players: GroupPlayer[] }>();
  for (const row of rows) {
    const group = groups.get(row.groupId) ?? { id: row.groupId, number: row.number, players: [] };
    groups.set(row.groupId, group);
    if (row.playerId !== null) {
      group.players.push({
        id: row.playerId,
        firstName: row.firstName!,
        lastName: row.lastName!,
        ranking: row.ranking,
      });
    }
  }
  return [...groups.values()];
}

type GroupPlayer = { id: number; firstName: string; lastName: string; ranking: number | null };
