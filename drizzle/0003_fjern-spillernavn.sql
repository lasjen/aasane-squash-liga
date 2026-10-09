ALTER TABLE "players" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "last_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "name";