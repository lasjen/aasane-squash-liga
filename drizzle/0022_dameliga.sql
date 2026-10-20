CREATE TYPE "public"."league" AS ENUM('open', 'women');--> statement-breakpoint
ALTER TABLE "round_groups" DROP CONSTRAINT "round_groups_round_number_unique";--> statement-breakpoint
ALTER TABLE "round_results" DROP CONSTRAINT "round_results_round_position_unique";--> statement-breakpoint
ALTER TABLE "round_ranking_snapshots" DROP CONSTRAINT "round_ranking_snapshots_round_id_player_id_pk";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "wants_womens_league" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "women_ranking" integer;--> statement-breakpoint
ALTER TABLE "ranking_info" ADD COLUMN "women_ranking_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "round_groups" ADD COLUMN "league" "league" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "round_ranking_snapshots" ADD COLUMN "league" "league" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "round_results" ADD COLUMN "league" "league" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "round_ranking_snapshots" ADD CONSTRAINT "round_ranking_snapshots_round_id_league_player_id_pk" PRIMARY KEY("round_id","league","player_id");--> statement-breakpoint
ALTER TABLE "round_groups" ADD CONSTRAINT "round_groups_round_league_number_unique" UNIQUE("round_id","league","number");--> statement-breakpoint
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_round_league_position_unique" UNIQUE("round_id","league","position");