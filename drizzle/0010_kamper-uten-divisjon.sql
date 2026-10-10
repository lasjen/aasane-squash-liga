ALTER TABLE "matches" DROP CONSTRAINT "matches_division_id_divisions_id_fk";
--> statement-breakpoint
DROP INDEX "matches_division_idx";--> statement-breakpoint
CREATE INDEX "matches_group_idx" ON "matches" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "division_id";