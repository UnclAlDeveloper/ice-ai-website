CREATE TABLE "aa"."lookups" (
	"id" serial PRIMARY KEY NOT NULL,
	"lookup_type" varchar NOT NULL,
	"code" varchar NOT NULL,
	"value" varchar,
	"description" varchar,
	CONSTRAINT "lookups_type_code_unique" UNIQUE("lookup_type","code")
);
--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ADD COLUMN "ai_target_market" varchar;--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ADD COLUMN "ai_niche_market" varchar;--> statement-breakpoint
CREATE INDEX "idx_lookups_type_code_unique" ON "aa"."lookups" USING btree ("lookup_type","code");