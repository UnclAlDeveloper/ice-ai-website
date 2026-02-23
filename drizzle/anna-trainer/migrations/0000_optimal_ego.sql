CREATE SCHEMA IF NOT EXISTS "at";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "at"."languages" (
	"code" varchar PRIMARY KEY NOT NULL,
	"language" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "at"."lookups" (
	"id" serial PRIMARY KEY NOT NULL,
	"lookup_type" varchar NOT NULL,
	"code" varchar NOT NULL,
	"value" varchar,
	"description" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "at"."preferred_languages" (
	"id" serial PRIMARY KEY NOT NULL,
	"language_code" varchar NOT NULL,
	"owner" varchar NOT NULL,
	"createdat" timestamp with time zone,
	"updatedat" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "at"."video_stages" (
	"code" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "at"."videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"language_code" varchar NOT NULL,
	"stage_code" varchar NOT NULL,
	"video_url" varchar,
	"transcript" varchar,
	"description" varchar,
	"raw_video_id" integer,
	"owner" varchar NOT NULL,
	"createdat" timestamp with time zone,
	"updatedat" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lookups_code" ON "at"."lookups" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lookups_lookup_type" ON "at"."lookups" USING btree ("lookup_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_preferred_languages_language_code" ON "at"."preferred_languages" USING btree ("language_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_preferred_languages_owner" ON "at"."preferred_languages" USING btree ("owner");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_videos_language_code" ON "at"."videos" USING btree ("language_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_videos_owner" ON "at"."videos" USING btree ("owner");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_videos_stage_code" ON "at"."videos" USING btree ("stage_code");
