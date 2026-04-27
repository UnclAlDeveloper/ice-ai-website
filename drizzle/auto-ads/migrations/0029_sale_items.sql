ALTER TYPE "aa"."listing_table" ADD VALUE 'SaleItem';--> statement-breakpoint
CREATE TABLE "aa"."sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"status" "aa"."sale_listing_status" NOT NULL,
	"title" varchar NOT NULL,
	"description" varchar,
	"asking_price" integer,
	"currency_symbol" char(1),
	"location" varchar,
	"ebay_category_id" varchar,
	"ebay_item_id" varchar,
	"eBayUrl" varchar,
	"facebookUrl" varchar
);
