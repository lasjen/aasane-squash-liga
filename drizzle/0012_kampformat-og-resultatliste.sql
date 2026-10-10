ALTER TABLE "rounds" ADD COLUMN "best_of" smallint DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_best_of_check" CHECK ("rounds"."best_of" IN (3, 5));