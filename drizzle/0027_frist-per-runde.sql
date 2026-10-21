ALTER TABLE "rounds" ADD COLUMN "signup_deadline_days" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "signup_deadline_time" time DEFAULT '20:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_deadline_days_check" CHECK ("rounds"."signup_deadline_days" BETWEEN 0 AND 6);--> statement-breakpoint
UPDATE "rounds" SET "signup_deadline_days" = "league_settings"."signup_deadline_days", "signup_deadline_time" = "league_settings"."signup_deadline_time" FROM "league_settings" WHERE "league_settings"."id" = 1 AND "rounds"."status" = 'open';
