CREATE TABLE "league_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"max_players" smallint DEFAULT 16 NOT NULL,
	"best_of" smallint DEFAULT 3 NOT NULL,
	"starts_at" time DEFAULT '18:30' NOT NULL,
	"ends_at" time DEFAULT '20:00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_settings_single_row_check" CHECK ("league_settings"."id" = 1),
	CONSTRAINT "league_settings_max_players_check" CHECK ("league_settings"."max_players" BETWEEN 4 AND 64),
	CONSTRAINT "league_settings_best_of_check" CHECK ("league_settings"."best_of" IN (3, 5)),
	CONSTRAINT "league_settings_time_check" CHECK ("league_settings"."starts_at" < "league_settings"."ends_at")
);
