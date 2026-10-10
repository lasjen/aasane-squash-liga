CREATE TABLE "cancelled_dates" (
	"date" date PRIMARY KEY NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cancelled_dates_thursday_check" CHECK (extract(isodow from "cancelled_dates"."date") = 4)
);
