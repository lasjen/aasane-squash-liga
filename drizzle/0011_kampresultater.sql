ALTER TABLE "matches" ADD COLUMN "player1_games" smallint;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player2_games" smallint;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "reported_by_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "confirmed_by_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_reported_by_id_players_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_confirmed_by_id_players_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_games_check" CHECK (("matches"."player1_games" IS NULL) = ("matches"."player2_games" IS NULL)
        AND ("matches"."player1_games" IS NULL OR ("matches"."player1_games" BETWEEN 0 AND 3
          AND "matches"."player2_games" BETWEEN 0 AND 3 AND "matches"."player1_games" <> "matches"."player2_games")));--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_played_games_check" CHECK ("matches"."status" <> 'played' OR "matches"."player1_games" IS NOT NULL);