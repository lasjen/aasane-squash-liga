CREATE TYPE "public"."match_source_result" AS ENUM('winner', 'loser');--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "division_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "player1_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "player2_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "group_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "number" smallint NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player1_source_match_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player1_source_result" "match_source_result";--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player2_source_match_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player2_source_result" "match_source_result";--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_round_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."round_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_source_match_id_matches_id_fk" FOREIGN KEY ("player1_source_match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_source_match_id_matches_id_fk" FOREIGN KEY ("player2_source_match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_number_unique" UNIQUE("group_id","number");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_known_check" CHECK ("matches"."player1_id" IS NOT NULL OR "matches"."player1_source_match_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_known_check" CHECK ("matches"."player2_id" IS NOT NULL OR "matches"."player2_source_match_id" IS NOT NULL);