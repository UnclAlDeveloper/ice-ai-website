import {pgSchema, varchar, text, timestamp} from "drizzle-orm/pg-core";

export const iaSchema = pgSchema("ia");

// OAUTH TOKENS
export const oauthTokens = iaSchema.table("oauth_tokens", {
	provider: varchar().primaryKey().notNull(),
	accountId: varchar("account_id"),
	accessToken: text("access_token"),
	accessTokenExpiry: timestamp("access_token_expiry", { withTimezone: true, mode: "string" }),
	refreshToken: text("refresh_token"),
	refreshTokenExpiry: timestamp("refresh_token_expiry", { withTimezone: true, mode: "string" }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
});
