ALTER TABLE "aa"."prospect_listings" ADD COLUMN "tax_status" varchar;--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ADD COLUMN "tax_due_date" date;--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ADD COLUMN "co2_emissions" integer;--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ADD COLUMN "marked_for_export" boolean;--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ADD COLUMN "date_of_last_v5c_issued" date;--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ADD COLUMN "month_of_first_registration" varchar;--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ADD COLUMN "type_approval" varchar;--> statement-breakpoint
ALTER TABLE "aa"."prospect_listings" ADD COLUMN "revenue_weight" integer;