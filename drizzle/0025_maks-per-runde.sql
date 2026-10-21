ALTER TABLE "rounds" ADD COLUMN "max_players" smallint DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_max_players_check" CHECK ("rounds"."max_players" BETWEEN 4 AND 64);--> statement-breakpoint
UPDATE "rounds" SET "max_players" = "league_settings"."max_players" FROM "league_settings" WHERE "league_settings"."id" = 1 AND "rounds"."status" = 'open';
