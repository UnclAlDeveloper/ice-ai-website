ALTER TABLE "aa"."prospect_listings" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "aa"."prospect_listing_status";--> statement-breakpoint
CREATE TYPE "aa"."prospect_listing_status" AS ENUM('New', 'Viewed', 'Not Interested', 'Interested', 'Bought');--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ALTER COLUMN "status" SET DATA TYPE "aa"."prospect_listing_status" USING "status"::"aa"."prospect_listing_status";