CREATE TABLE "round_ranking_snapshots" (
	"round_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"ranking" integer NOT NULL,
	CONSTRAINT "round_ranking_snapshots_round_id_player_id_pk" PRIMARY KEY("round_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "round_ranking_snapshots" ADD CONSTRAINT "round_ranking_snapshots_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_ranking_snapshots" ADD CONSTRAINT "round_ranking_snapshots_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;