CREATE TABLE "round_group_players" (
	"round_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	CONSTRAINT "round_group_players_group_id_player_id_pk" PRIMARY KEY("group_id","player_id"),
	CONSTRAINT "round_group_players_round_player_unique" UNIQUE("round_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "round_groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "round_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"round_id" integer NOT NULL,
	"number" smallint NOT NULL,
	CONSTRAINT "round_groups_round_number_unique" UNIQUE("round_id","number"),
	CONSTRAINT "round_groups_id_round_unique" UNIQUE("id","round_id"),
	CONSTRAINT "round_groups_number_check" CHECK ("round_groups"."number" >= 1)
);
--> statement-breakpoint
ALTER TABLE "round_group_players" ADD CONSTRAINT "round_group_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_group_players" ADD CONSTRAINT "round_group_players_group_fk" FOREIGN KEY ("group_id","round_id") REFERENCES "public"."round_groups"("id","round_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_groups" ADD CONSTRAINT "round_groups_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;