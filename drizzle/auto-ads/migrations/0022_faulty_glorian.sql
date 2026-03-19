ALTER TABLE "aa"."resale_listings" RENAME COLUMN "hash_code" TO "prospect_id";--> statement-breakpoint
ALTER TABLE "aa"."resale_listings" DROP CONSTRAINT "resale_listings_hash_code_unique";--> statement-breakpoint
DROP INDEX "aa"."idx_resale_listings_hash_code";