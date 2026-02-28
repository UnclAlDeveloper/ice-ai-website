ALTER TYPE "aa"."listing_source" ADD VALUE 'Car&Classic' BEFORE 'eBay';--> statement-breakpoint
ALTER TYPE "aa"."listing_source" ADD VALUE 'ManualEntry' BEFORE 'OnlyVans';--> statement-breakpoint
ALTER TABLE "aa"."images" DROP COLUMN "listing_source";