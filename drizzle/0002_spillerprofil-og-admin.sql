CREATE TYPE "public"."player_gender" AS ENUM('female', 'male', 'other');--> statement-breakpoint
CREATE TYPE "public"."player_level" AS ENUM('beginner', 'intermediate', 'experienced', 'pro');--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admins_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "gender" "player_gender";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "level" "player_level";--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_idx" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
-- Deler eksisterende navn i fornavn og etternavn. Siste ord blir etternavnet,
-- så «Anne Lise Berg» blir «Anne Lise» og «Berg». Kolonnen name slettes i neste migrasjon.
UPDATE "players" SET
	"first_name" = regexp_replace(btrim("name"), '\s+\S+$', ''),
	"last_name" = CASE WHEN btrim("name") ~ '\s' THEN substring(btrim("name") from '(\S+)$') ELSE '' END;
