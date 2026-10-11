CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "rankedin_id" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "rankedin_standing" smallint;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "rankedin_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "pro_check_status" text;