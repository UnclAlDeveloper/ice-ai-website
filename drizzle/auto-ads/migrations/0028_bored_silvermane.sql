CREATE TYPE "aa"."sale_listing_status" AS ENUM('Inventory', 'Sold');--> statement-breakpoint
ALTER TABLE "aa"."resale_listings" ALTER COLUMN "eBayUrl" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "aa"."resale_listings" ALTER COLUMN "facebookUrl" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "aa"."lookups" ADD COLUMN "extra" varchar;