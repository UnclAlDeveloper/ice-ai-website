CREATE TABLE "ia"."oauth_tokens" (
	"provider" varchar PRIMARY KEY NOT NULL,
	"account_id" varchar,
	"access_token" text,
	"access_token_expiry" timestamp with time zone,
	"refresh_token" text,
	"refresh_token_expiry" timestamp with time zone,
	"updated_at" timestamp with time zone
);
