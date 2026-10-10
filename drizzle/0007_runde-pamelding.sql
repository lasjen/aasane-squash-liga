CREATE TYPE "public"."round_status" AS ENUM('open', 'started', 'finished');--> statement-breakpoint
CREATE TABLE "round_signups" (
	"round_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_signups_round_id_player_id_pk" PRIMARY KEY("round_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "status" "round_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "round_signups" ADD CONSTRAINT "round_signups_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_signups" ADD CONSTRAINT "round_signups_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "round_signups_player_idx" ON "round_signups" USING btree ("player_id");