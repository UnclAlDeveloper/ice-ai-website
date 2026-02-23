ALTER TABLE "aa"."images" ALTER COLUMN "listing_source" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ALTER COLUMN "listing_source" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "aa"."listing_source";--> statement-breakpoint
CREATE TYPE "aa"."listing_source" AS ENUM('Autotrader', 'eBay', 'Facebook', 'Gumtree', 'OnlyVans');--> statement-breakpoint
ALTER TABLE "aa"."images" ALTER COLUMN "listing_source" SET DATA TYPE "aa"."listing_source" USING "listing_source"::"aa"."listing_source";--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ALTER COLUMN "listing_source" SET DATA TYPE "aa"."listing_source" USING "listing_source"::"aa"."listing_source";