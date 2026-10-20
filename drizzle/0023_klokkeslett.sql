ALTER TABLE "rounds" ADD COLUMN "starts_at" time DEFAULT '18:30' NOT NULL;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "ends_at" time DEFAULT '20:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "time_note" text;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_time_check" CHECK ("rounds"."starts_at" < "rounds"."ends_at");