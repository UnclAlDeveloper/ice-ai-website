ALTER TABLE "aa"."resale_listings" DROP COLUMN IF EXISTS "prospect_id";--> statement-breakpoint
ALTER TABLE "aa"."resale_listings" DROP COLUMN IF EXISTS "hash_code";--> statement-breakpoint
ALTER TABLE "aa"."resale_listings" ADD COLUMN "prospect_id" integer;