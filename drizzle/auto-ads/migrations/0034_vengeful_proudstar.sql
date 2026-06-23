CREATE TYPE "aa"."listing_type" AS ENUM('Car', 'Van', 'Classic', 'Item', 'Boat', 'Yacht');--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ADD COLUMN "listing_type" "aa"."listing_type";--> statement-breakpoint
CREATE INDEX "idx_prospect_listings_source_id" ON "aa"."prospect_listings" USING btree ("source_id" bpchar_ops);