ALTER TABLE "matches" DROP CONSTRAINT "matches_player1_known_check";--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_player2_known_check";--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "pool" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player1_source_pool_rank" smallint;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player2_source_pool_rank" smallint;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_pool_check" CHECK ("matches"."pool" IS NULL OR "matches"."pool" IN ('A', 'B'));--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_pool_rank_check" CHECK (("matches"."player1_source_pool_rank" IS NULL OR "matches"."player1_source_pool_rank" IN (1, 2))
        AND ("matches"."player2_source_pool_rank" IS NULL OR "matches"."player2_source_pool_rank" IN (1, 2)));--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_known_check" CHECK ("matches"."player1_id" IS NOT NULL OR "matches"."player1_source_match_id" IS NOT NULL OR "matches"."player1_source_pool_rank" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_known_check" CHECK ("matches"."player2_id" IS NOT NULL OR "matches"."player2_source_match_id" IS NOT NULL OR "matches"."player2_source_pool_rank" IS NOT NULL);