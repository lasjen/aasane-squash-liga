CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'played', 'walkover', 'cancelled');--> statement-breakpoint
CREATE TABLE "division_players" (
	"season_id" integer NOT NULL,
	"division_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "division_players_division_id_player_id_pk" PRIMARY KEY("division_id","player_id"),
	CONSTRAINT "division_players_season_player_unique" UNIQUE("season_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "divisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"season_id" integer NOT NULL,
	"name" text NOT NULL,
	"level" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "divisions_season_level_unique" UNIQUE("season_id","level"),
	CONSTRAINT "divisions_id_season_unique" UNIQUE("id","season_id"),
	CONSTRAINT "divisions_level_check" CHECK ("divisions"."level" >= 1)
);
--> statement-breakpoint
CREATE TABLE "match_games" (
	"match_id" integer NOT NULL,
	"game_number" smallint NOT NULL,
	"player1_points" smallint NOT NULL,
	"player2_points" smallint NOT NULL,
	CONSTRAINT "match_games_match_id_game_number_pk" PRIMARY KEY("match_id","game_number"),
	CONSTRAINT "match_games_number_check" CHECK ("match_games"."game_number" BETWEEN 1 AND 5),
	CONSTRAINT "match_games_points_check" CHECK ("match_games"."player1_points" >= 0 AND "match_games"."player2_points" >= 0 AND "match_games"."player1_points" <> "match_games"."player2_points")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "matches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"round_id" integer NOT NULL,
	"division_id" integer NOT NULL,
	"player1_id" integer NOT NULL,
	"player2_id" integer NOT NULL,
	"court" smallint,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"winner_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_distinct_players_check" CHECK ("matches"."player1_id" <> "matches"."player2_id"),
	CONSTRAINT "matches_winner_check" CHECK ("matches"."winner_id" IS NULL OR "matches"."winner_id" IN ("matches"."player1_id", "matches"."player2_id")),
	CONSTRAINT "matches_winner_status_check" CHECK (("matches"."status" IN ('played', 'walkover')) = ("matches"."winner_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "players_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rounds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"season_id" integer NOT NULL,
	"number" smallint NOT NULL,
	"played_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rounds_season_number_unique" UNIQUE("season_id","number"),
	CONSTRAINT "rounds_season_date_unique" UNIQUE("season_id","played_on")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "seasons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_name_unique" UNIQUE("name"),
	CONSTRAINT "seasons_dates_check" CHECK ("seasons"."ends_on" IS NULL OR "seasons"."ends_on" >= "seasons"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "division_players" ADD CONSTRAINT "division_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "division_players" ADD CONSTRAINT "division_players_division_fk" FOREIGN KEY ("division_id","season_id") REFERENCES "public"."divisions"("id","season_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_players_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_round_idx" ON "matches" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "matches_division_idx" ON "matches" USING btree ("division_id");