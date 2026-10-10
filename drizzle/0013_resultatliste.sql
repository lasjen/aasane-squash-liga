CREATE TABLE "round_results" (
	"round_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"group_number" smallint NOT NULL,
	"group_position" smallint NOT NULL,
	"wins" smallint NOT NULL,
	"losses" smallint NOT NULL,
	"sets_won" smallint NOT NULL,
	"sets_lost" smallint NOT NULL,
	"ranking_before" integer,
	"ranking_after" integer,
	CONSTRAINT "round_results_round_id_player_id_pk" PRIMARY KEY("round_id","player_id"),
	CONSTRAINT "round_results_round_position_unique" UNIQUE("round_id","position")
);
--> statement-breakpoint
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;