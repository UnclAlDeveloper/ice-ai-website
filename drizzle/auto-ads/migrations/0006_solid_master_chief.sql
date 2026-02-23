CREATE TABLE "aa"."saved_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"query" text NOT NULL,
	"last_used_at" timestamp with time zone NOT NULL,
	CONSTRAINT "saved_searches_user_id_query_unique" UNIQUE("user_id","query")
);
--> statement-breakpoint
CREATE INDEX "idx_saved_searches_user_id_last_used_at" ON "aa"."saved_searches" USING btree ("user_id","last_used_at");