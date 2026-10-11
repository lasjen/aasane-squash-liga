CREATE TYPE "public"."player_role" AS ENUM('player', 'operator', 'admin');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" integer,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "role" "player_role" DEFAULT 'player' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_players_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
-- Dagens admin-rolle heter nå operatør. Admin er en ny rolle som gis med «npm run admin».
UPDATE "players" SET "role" = 'operator' WHERE "is_admin";
