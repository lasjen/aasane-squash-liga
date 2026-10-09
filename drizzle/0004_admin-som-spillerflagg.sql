DROP TABLE "admin_sessions" CASCADE;--> statement-breakpoint
DROP TABLE "admins" CASCADE;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;