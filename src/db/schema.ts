import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Spillere i klubben. Beholdes på tvers av sesonger. */
export const players = pgTable("players", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").unique(),
  phone: text("phone"),
  /** scrypt-hash av passordet. Null for spillere som ikke har opprettet innlogging. */
  passwordHash: text("password_hash"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
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
    ...timestamps,
  },
  (t) => [
    unique("rounds_season_number_unique").on(t.seasonId, t.number),
    unique("rounds_season_date_unique").on(t.seasonId, t.playedOn),
  ],
);

export const matchStatus = pgEnum("match_status", [
  "scheduled", // satt opp, ikke spilt
  "played", // spilt, resultat registrert
  "walkover", // en spiller stilte ikke
  "cancelled", // avlyst
]);

/** En kamp mellom to spillere i samme divisjon på en kampkveld. */
export const matches = pgTable(
  "matches",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    divisionId: integer("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
    player1Id: integer("player1_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    player2Id: integer("player2_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    court: smallint("court"),
    status: matchStatus("status").notNull().default("scheduled"),
    winnerId: integer("winner_id").references(() => players.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => [
    index("matches_round_idx").on(t.roundId),
    index("matches_division_idx").on(t.divisionId),
    check("matches_distinct_players_check", sql`${t.player1Id} <> ${t.player2Id}`),
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
