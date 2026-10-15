CREATE TABLE "ranking_info" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"message" text,
	"ranking_updated_at" timestamp with time zone,
	CONSTRAINT "ranking_info_single_row_check" CHECK ("ranking_info"."id" = 1)
);
