ALTER TABLE "league_settings" ADD COLUMN "signup_deadline_days" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "league_settings" ADD COLUMN "signup_deadline_time" time DEFAULT '20:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "league_settings" ADD CONSTRAINT "league_settings_deadline_days_check" CHECK ("league_settings"."signup_deadline_days" BETWEEN 0 AND 6);