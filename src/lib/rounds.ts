import "server-only";

import { and, asc, desc, eq, gte, isNull, lte, max, or, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { addDays, osloToday, seasonFor, thursdayOnOrAfter } from "@/lib/dates";
import { getLeagueSettings } from "@/lib/league-settings";
import { groupLabel, type League } from "@/lib/leagues";

type Db = typeof db;
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Neste runde spillerne kan melde seg på: førstkommende torsdag (i dag, hvis det er torsdag),
 * men ikke torsdager uten liga, og ikke en runde admin allerede har startet eller avsluttet.
 * `round` er null hvis ingen har meldt seg på ennå, for runden lages først ved første påmelding.
 */
export async function findNextRound(now: Date = new Date()) {
  const today = osloToday(now);
  const cancelled = new Set(
    (
      await db
        .select({ date: schema.cancelledDates.date })
        .from(schema.cancelledDates)
        .where(gte(schema.cancelledDates.date, today))
    ).map((c) => c.date),
  );

  // To år fram er langt mer enn nok, selv med mange avlyste torsdager.
  let date = thursdayOnOrAfter(today);
  for (let i = 0; i < 104; i++, date = addDays(date, 7)) {
    if (cancelled.has(date)) continue;
    const [round] = await db
      .select({
        id: schema.rounds.id,
        number: schema.rounds.number,
        status: schema.rounds.status,
        bestOf: schema.rounds.bestOf,
        startsAt: schema.rounds.startsAt,
        endsAt: schema.rounds.endsAt,
        timeNote: schema.rounds.timeNote,
      })
      .from(schema.rounds)
      .where(eq(schema.rounds.playedOn, date))
      .limit(1);
    if (!round || round.status === "open") return { date, round: round ?? null };
  }
  throw new Error("Fant ingen torsdag med liga de neste to årene.");
}

/**
 * Kommende torsdager uten liga, fra i dag og framover. Spillerne ser bare de som ikke er
 * skjult; admin ser alle med `includeHidden`.
 */
export async function getUpcomingCancellations({ includeHidden = false } = {}) {
  const rows = await db
    .select({
      date: schema.cancelledDates.date,
      reason: schema.cancelledDates.reason,
      hidden: schema.cancelledDates.hidden,
    })
    .from(schema.cancelledDates)
    .where(gte(schema.cancelledDates.date, osloToday()))
    .orderBy(asc(schema.cancelledDates.date));
  return includeHidden ? rows : rows.filter((r) => !r.hidden);
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
      startsAt: schema.rounds.startsAt,
      endsAt: schema.rounds.endsAt,
      timeNote: schema.rounds.timeNote,
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
 * Runden på datoen. Lages hvis den ikke finnes, med neste rundenummer i sesongen og
 * kampformatet og klokkeslettet fra Innstillinger.
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
  const { bestOf, startsAt, endsAt } = await getLeagueSettings(tx);
  const [created] = await tx
    .insert(schema.rounds)
    .values({ seasonId, number: (last ?? 0) + 1, playedOn: date, bestOf, startsAt, endsAt })
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
      womenRanking: schema.players.womenRanking,
      gender: schema.players.gender,
      wantsWomensLeague: schema.players.wantsWomensLeague,
      active: schema.players.active,
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
      round: { ...started, status: "started" as const },
    };
  }
  return findNextRound();
}

/**
 * Gruppene i runden, «Alle» først og så damegruppene, med spillerne sortert etter ranking.
 * `ranking` er plassen i ligaen gruppen hører til (dameligaens ranking i damegrupper).
 */
export async function getGroups(roundId: number) {
  const rows = await db
    .select({
      groupId: schema.roundGroups.id,
      league: schema.roundGroups.league,
      number: schema.roundGroups.number,
      playerId: schema.players.id,
      firstName: schema.players.firstName,
      lastName: schema.players.lastName,
      ranking: schema.players.ranking,
      womenRanking: schema.players.womenRanking,
    })
    .from(schema.roundGroups)
    .leftJoin(schema.roundGroupPlayers, eq(schema.roundGroupPlayers.groupId, schema.roundGroups.id))
    .leftJoin(schema.players, eq(schema.players.id, schema.roundGroupPlayers.playerId))
    .where(eq(schema.roundGroups.roundId, roundId))
    .orderBy(
      asc(schema.roundGroups.league),
      asc(schema.roundGroups.number),
      sql`case when ${schema.roundGroups.league} = 'women' then ${schema.players.womenRanking} end asc nulls last`,
      sql`${schema.players.ranking} asc nulls last`,
      asc(schema.players.lastName),
    );

  const groups = new Map<number, RoundGroup>();
  for (const row of rows) {
    const group = groups.get(row.groupId) ?? {
      id: row.groupId,
      league: row.league,
      number: row.number,
      label: groupLabel(row.league, row.number),
      players: [],
    };
    groups.set(row.groupId, group);
    if (row.playerId !== null) {
      group.players.push({
        id: row.playerId,
        firstName: row.firstName!,
        lastName: row.lastName!,
        ranking: row.league === "women" ? row.womenRanking : row.ranking,
      });
    }
  }
  return [...groups.values()];
}

type GroupPlayer = { id: number; firstName: string; lastName: string; ranking: number | null };
export type RoundGroup = { id: number; league: League; number: number; label: string; players: GroupPlayer[] };
