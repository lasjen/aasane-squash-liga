ALTER TABLE "cancelled_dates" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "deleted_at" timestamp with time zone;