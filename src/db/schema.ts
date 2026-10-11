import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { GENDERS, LEVELS } from "../lib/player-options";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const playerGender = pgEnum("player_gender", GENDERS);
export const playerLevel = pgEnum("player_level", LEVELS);

/** Spillere i klubben. Beholdes på tvers av sesonger. */
export const players = pgTable("players", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").unique(),
  phone: text("phone"),
  /** Null for spillere som er lagt inn før feltet fantes. */
  gender: playerGender("gender"),
  /** Spillerens egen vurdering av nivået sitt. */
  level: playerLevel("level"),
  /** Plass i klubbens ranking, 1 er best. Null for spillere som ikke er rangert ennå. */
  ranking: integer("ranking"),
  /**
   * RankedIn-ID (f.eks. «R000002691») for spillere med nivå Proff, når kravet om
   * norgesranking er slått på. Brukes til å sjekke plasseringen på nytt.
   */
  rankedinId: text("rankedin_id"),
  /** Plassering på norgesrankingen sist den ble sjekket. */
  rankedinStanding: smallint("rankedin_standing"),
  rankedinCheckedAt: timestamp("rankedin_checked_at", { withTimezone: true }),
  /**
   * Status for proff-kravet: "ok" (innenfor grensen), "below" (falt utenfor ved siste sjekk),
   * "unchecked" (RankedIn svarte ikke) eller "manual" (satt av admin). Null når kravet ikke gjelder.
   */
  proCheckStatus: text("pro_check_status"),
  /** scrypt-hash av passordet. Null for spillere som ikke har opprettet innlogging. */
  passwordHash: text("password_hash"),
  /** Gir tilgang til /admin. Settes med `npm run admin`. */
  isAdmin: boolean("is_admin").notNull().default(false),
  active: boolean("active").notNull().default(true),
  /**
   * Satt når admin har slettet spilleren. Personopplysningene er da fjernet og navnet
   * er «Tidligere spiller», men raden beholdes så kamper og resultatlister henger sammen.
   */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
});

/**
 * Innstillinger admin kan endre, som nøkkel og JSON-verdi. Se src/lib/settings.ts
 * for hvilke nøkler som finnes og standardverdiene deres.
 */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamps.updatedAt,
});

/**
 * Innloggingsøkter. Id-en er en SHA-256-hash av tokenet i cookien,
 * så en lekket database ikke kan brukes til å kapre økter.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("sessions_player_idx").on(t.playerId)],
);

/**
 * Admin-økter. Adskilt fra `sessions` med egen cookie, så en vanlig
 * spillerinnlogging aldri gir admin-tilgang, selv for spillere med is_admin.
 */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("admin_sessions_player_idx").on(t.playerId)],
);

/** En sesong av torsdagsligaen, f.eks. «Høst 2026». */
export const seasons = pgTable(
  "seasons",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull().unique(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    ...timestamps,
  },
  (t) => [
    check("seasons_dates_check", sql`${t.endsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`),
  ],
);

/** Divisjoner innenfor en sesong. Nivå 1 er øverste divisjon. */
export const divisions = pgTable(
  "divisions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    level: smallint("level").notNull(),
    ...timestamps,
  },
  (t) => [
    unique("divisions_season_level_unique").on(t.seasonId, t.level),
    // Trengs for den sammensatte fremmednøkkelen fra division_players.
    unique("divisions_id_season_unique").on(t.id, t.seasonId),
    check("divisions_level_check", sql`${t.level} >= 1`),
  ],
);

/**
 * Hvilken divisjon en spiller tilhører i en sesong.
 * En spiller kan bare være i én divisjon per sesong.
 */
export const divisionPlayers = pgTable(
  "division_players",
  {
    seasonId: integer("season_id").notNull(),
    divisionId: integer("division_id").notNull(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.divisionId, t.playerId] }),
    unique("division_players_season_player_unique").on(t.seasonId, t.playerId),
    foreignKey({
      name: "division_players_division_fk",
      columns: [t.divisionId, t.seasonId],
      foreignColumns: [divisions.id, divisions.seasonId],
    }).onDelete("cascade"),
  ],
);

/**
 * Torsdager uten ligaspill, f.eks. ferier. Neste runde hopper over disse datoene.
 * Avlyses en runde med påmeldinger, slettes runden og påmeldingene.
 */
export const cancelledDates = pgTable(
  "cancelled_dates",
  {
    date: date("date").primaryKey(),
    reason: text("reason"),
    /** Skjult for spillerne. Datoen hoppes likevel over når neste runde finnes. */
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamps.createdAt,
  },
  (t) => [check("cancelled_dates_thursday_check", sql`extract(isodow from ${t.date}) = 4`)],
);

export const roundStatus = pgEnum("round_status", [
  "open", // påmeldingen er åpen
  "started", // admin har startet runden, grupper og kamper er satt opp
  "finished", // alle kamper er ferdig registrert
]);

/** En kampkveld (torsdag) i en sesong. */
export const rounds = pgTable(
  "rounds",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    number: smallint("number").notNull(),
    playedOn: date("played_on").notNull(),
    status: roundStatus("status").notNull().default("open"),
    /** Kampformat: best av 3 eller best av 5 sett. */
    bestOf: smallint("best_of").notNull().default(3),
    ...timestamps,
  },
  (t) => [
    unique("rounds_season_number_unique").on(t.seasonId, t.number),
    unique("rounds_season_date_unique").on(t.seasonId, t.playedOn),
    check("rounds_best_of_check", sql`${t.bestOf} IN (3, 5)`),
  ],
);

/**
 * Hvem som har meldt seg på en runde. Spillere melder seg på selv,
 * og admin kan legge til eller fjerne spillere ved oppmøte.
 */
export const roundSignups = pgTable(
  "round_signups",
  {
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.roundId, t.playerId] }),
    index("round_signups_player_idx").on(t.playerId),
  ],
);

export const matchStatus = pgEnum("match_status", [
  "scheduled", // satt opp, ikke spilt
  "played", // spilt, resultat registrert
  "walkover", // en spiller stilte ikke
  "cancelled", // avlyst
]);

/** Gruppene i en runde. Gruppe 1 er øverst (best rangerte spillere). */
export const roundGroups = pgTable(
  "round_groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    number: smallint("number").notNull(),
  },
  (t) => [
    unique("round_groups_round_number_unique").on(t.roundId, t.number),
    // Trengs for den sammensatte fremmednøkkelen fra round_group_players.
    unique("round_groups_id_round_unique").on(t.id, t.roundId),
    check("round_groups_number_check", sql`${t.number} >= 1`),
  ],
);

/** Hvilken gruppe en spiller er i. En spiller kan bare være i én gruppe per runde. */
export const roundGroupPlayers = pgTable(
  "round_group_players",
  {
    roundId: integer("round_id").notNull(),
    groupId: integer("group_id").notNull(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.playerId] }),
    unique("round_group_players_round_player_unique").on(t.roundId, t.playerId),
    foreignKey({
      name: "round_group_players_group_fk",
      columns: [t.groupId, t.roundId],
      foreignColumns: [roundGroups.id, roundGroups.roundId],
    }).onDelete("cascade"),
  ],
);

/**
 * Resultatlisten for en avsluttet runde: én rad per deltaker, i endelig rekkefølge
 * på tvers av gruppene, med ranking før og etter runden.
 */
export const roundResults = pgTable(
  "round_results",
  {
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** Plass i resultatlisten, fra 1. */
    position: smallint("position").notNull(),
    groupNumber: smallint("group_number").notNull(),
    /** Plass i egen gruppe, fra 1. */
    groupPosition: smallint("group_position").notNull(),
    wins: smallint("wins").notNull(),
    losses: smallint("losses").notNull(),
    setsWon: smallint("sets_won").notNull(),
    setsLost: smallint("sets_lost").notNull(),
    rankingBefore: integer("ranking_before"),
    rankingAfter: integer("ranking_after"),
  },
  (t) => [
    primaryKey({ columns: [t.roundId, t.playerId] }),
    unique("round_results_round_position_unique").on(t.roundId, t.position),
  ],
);

/**
 * Rankingen slik den var før runden, for alle aktive rangerte spillere. Lagres når runden
 * avsluttes, så resultatlisten og ny ranking kan regnes ut på nytt hvis et resultat rettes.
 */
export const roundRankingSnapshots = pgTable(
  "round_ranking_snapshots",
  {
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    ranking: integer("ranking").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.playerId] })],
);

/** Om en spiller i en kamp er vinneren eller taperen fra en tidligere kamp. */
export const matchSourceResult = pgEnum("match_source_result", ["winner", "loser"]);

/**
 * En kamp i en gruppe på en kampkveld. I grupper på 4 avhenger de to siste kampene
 * av resultatene i de to første (vinner mot vinner, taper mot taper). Da er spilleren
 * null til resultatet finnes, og `playerXSourceMatchId`/`playerXSourceResult` sier
 * hvor spilleren kommer fra.
 */
export const matches = pgTable(
  "matches",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => roundGroups.id, { onDelete: "cascade" }),
    /** Rekkefølgen kampene spilles i innenfor gruppen, fra 1. */
    number: smallint("number").notNull(),
    player1Id: integer("player1_id").references(() => players.id, { onDelete: "restrict" }),
    player2Id: integer("player2_id").references(() => players.id, { onDelete: "restrict" }),
    player1SourceMatchId: integer("player1_source_match_id").references(
      (): AnyPgColumn => matches.id,
      { onDelete: "cascade" },
    ),
    player1SourceResult: matchSourceResult("player1_source_result"),
    player2SourceMatchId: integer("player2_source_match_id").references(
      (): AnyPgColumn => matches.id,
      { onDelete: "cascade" },
    ),
    player2SourceResult: matchSourceResult("player2_source_result"),
    /** I 5-grupper: hvilken pulje kampen hører til ("A" eller "B"). Null ellers. */
    pool: text("pool"),
    /**
     * I 5-grupper: spilleren er nr. 1 eller 2 i pulje A i samme gruppe.
     * Fylles inn når alle kampene i pulje A har resultat.
     */
    player1SourcePoolRank: smallint("player1_source_pool_rank"),
    player2SourcePoolRank: smallint("player2_source_pool_rank"),
    court: smallint("court"),
    status: matchStatus("status").notNull().default("scheduled"),
    winnerId: integer("winner_id").references(() => players.id, { onDelete: "restrict" }),
    /** Vunne game for hver spiller, f.eks. 3 og 1. Null før resultatet er registrert. */
    player1Games: smallint("player1_games"),
    player2Games: smallint("player2_games"),
    /** Hvem som sist registrerte resultatet (spiller eller admin). */
    reportedById: integer("reported_by_id").references(() => players.id, { onDelete: "set null" }),
    reportedAt: timestamp("reported_at", { withTimezone: true }),
    /**
     * Satt når resultatet er bekreftet, av motspilleren eller av en admin.
     * Et spilt resultat uten bekreftelse venter på motspilleren.
     */
    confirmedById: integer("confirmed_by_id").references(() => players.id, { onDelete: "set null" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("matches_round_idx").on(t.roundId),
    check(
      "matches_games_check",
      sql`(${t.player1Games} IS NULL) = (${t.player2Games} IS NULL)
        AND (${t.player1Games} IS NULL OR (${t.player1Games} BETWEEN 0 AND 3
          AND ${t.player2Games} BETWEEN 0 AND 3 AND ${t.player1Games} <> ${t.player2Games}))`,
    ),
    check(
      "matches_played_games_check",
      sql`${t.status} <> 'played' OR ${t.player1Games} IS NOT NULL`,
    ),
    index("matches_group_idx").on(t.groupId),
    unique("matches_group_number_unique").on(t.groupId, t.number),
    check("matches_distinct_players_check", sql`${t.player1Id} <> ${t.player2Id}`),
    // Hver spillerplass har enten en spiller eller en kilde (eller begge, når kilden er avgjort).
    check(
      "matches_player1_known_check",
      sql`${t.player1Id} IS NOT NULL OR ${t.player1SourceMatchId} IS NOT NULL OR ${t.player1SourcePoolRank} IS NOT NULL`,
    ),
    check(
      "matches_player2_known_check",
      sql`${t.player2Id} IS NOT NULL OR ${t.player2SourceMatchId} IS NOT NULL OR ${t.player2SourcePoolRank} IS NOT NULL`,
    ),
    check("matches_pool_check", sql`${t.pool} IS NULL OR ${t.pool} IN ('A', 'B')`),
    check(
      "matches_pool_rank_check",
      sql`(${t.player1SourcePoolRank} IS NULL OR ${t.player1SourcePoolRank} IN (1, 2))
        AND (${t.player2SourcePoolRank} IS NULL OR ${t.player2SourcePoolRank} IN (1, 2))`,
    ),
    check(
      "matches_winner_check",
      sql`${t.winnerId} IS NULL OR ${t.winnerId} IN (${t.player1Id}, ${t.player2Id})`,
    ),
    check(
      "matches_winner_status_check",
      sql`(${t.status} IN ('played', 'walkover')) = (${t.winnerId} IS NOT NULL)`,
    ),
  ],
);

/** Poeng per game i en kamp (best av fem, til 11). */
export const matchGames = pgTable(
  "match_games",
  {
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    gameNumber: smallint("game_number").notNull(),
    player1Points: smallint("player1_points").notNull(),
    player2Points: smallint("player2_points").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.gameNumber] }),
    check("match_games_number_check", sql`${t.gameNumber} BETWEEN 1 AND 5`),
    check(
      "match_games_points_check",
      sql`${t.player1Points} >= 0 AND ${t.player2Points} >= 0 AND ${t.player1Points} <> ${t.player2Points}`,
    ),
  ],
);
