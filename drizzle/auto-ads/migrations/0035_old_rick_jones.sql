ALTER TABLE "aa"."prospect_listings" ALTER COLUMN "listing_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "aa"."resale_listings" ADD COLUMN "listing_type" "aa"."listing_type";