-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
CREATE SCHEMA "aa";
--> statement-breakpoint
CREATE TYPE "aa"."listing_source" AS ENUM('Autotrader', 'Ebay', 'Facebook', 'Gummtree', 'OnlyVans');--> statement-breakpoint
CREATE TYPE "aa"."listing_table" AS ENUM('Prospect', 'Resale');--> statement-breakpoint
CREATE TYPE "aa"."prospect_listing_status" AS ENUM('New', 'Viewed', 'NotInterested', 'Interested', 'Bought');--> statement-breakpoint
CREATE TABLE "aa"."images" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" varchar NOT NULL,
	"is_primary" boolean,
	"created_at" timestamp with time zone,
	"listing_id" integer NOT NULL,
	"listing_source" "aa"."listing_source" NOT NULL,
	"listing_table" "aa"."listing_table" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aa"."prospect_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"hash_code" char(16) NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"make_and_model" varchar NOT NULL,
	"short_description" varchar NOT NULL,
	"url" varchar NOT NULL,
	"full_description" varchar,
	"mileage" integer,
	"mileage_unit" varchar,
	"year" integer,
	"registration" varchar,
	"currency_symbol" char(1),
	"asking_price" integer NOT NULL,
	"vat_status" varchar,
	"location" varchar,
	"body_type" varchar,
	"cab_type" varchar,
	"fuel_type" varchar,
	"gearbox_type" varchar,
	"wheelbase" varchar,
	"engine_size" varchar,
	"colour" varchar,
	"seats" integer,
	"emission_class" varchar,
	"number_of_owners" integer,
	"service_history" varchar,
	"basic_history_check" varchar,
	"mot_status" varchar,
	"mot_expiry" date,
	"ai_work_and_repairs" varchar,
	"ai_repair_cost" integer,
	"ai_sell_price_low" integer,
	"ai_sell_price_high" integer,
	"specs_and_features" varchar,
	"interest_level" smallint,
	"ai_listing_summary" varchar,
	"ai_resell_overview" varchar,
	"ai_resell_notes" varchar,
	"ai_buy_price_low" integer,
	"ai_buy_price_high" integer,
	"listing_source" "aa"."listing_source" NOT NULL,
	"status" "aa"."prospect_listing_status" NOT NULL,
	CONSTRAINT "prospect_listings_hash_code_unique" UNIQUE("hash_code")
);
--> statement-breakpoint
CREATE INDEX "idx_prospect_listings_hash_code" ON "aa"."prospect_listings" USING btree ("hash_code" bpchar_ops);
