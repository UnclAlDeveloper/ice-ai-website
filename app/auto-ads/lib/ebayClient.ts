import eBayApi from "ebay-api";
import {eq} from "drizzle-orm";
import {oauthTokens} from "@/drizzle/ice-ai/schema";
import {getIceAiDb} from "@app/lib/iceAiDb";

// MARKETPLACE ID TYPE
type EbayMarketplaceId = (typeof eBayApi.MarketplaceId)[keyof typeof eBayApi.MarketplaceId];
/**
 * Union of supported REST marketplace ids from the eBay client enum.
 */

// EBAY SELL SCOPES
const EBAY_SELL_SCOPES = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.account",
] as const;
/**
 * OAuth scopes required for inventory item creation, offers, and business policies.
 */

// GET EBAY REFRESH TOKEN FROM ICE AI DB
async function getEbayRefreshTokenFromIceAiDb(): Promise<string | null> {
    /**
     * Reads the eBay user refresh token from ia.oauth_tokens, same row the Python
     * stack persists via ice_ai_api /auto-ads-ebay-redirect after /ebay-connect.
     */

    if (!process.env.ICE_AI_DATABASE_URL?.trim()) {
        return null;
    }

    try {
        const db = getIceAiDb();
        const rows = await db
            .select({refreshToken: oauthTokens.refreshToken})
            .from(oauthTokens)
            .where(eq(oauthTokens.provider, "ebay"))
            .limit(1);
        const t = rows[0]?.refreshToken?.trim();
        return t || null;
    } catch (err) {
        console.error("Failed to read eBay refresh token from ia.oauth_tokens:", err);
        return null;
    }
}

// EBAY USE SANDBOX
function ebayUseSandbox(): boolean {
    /**
     * Matches ice_ai_api._ebay_oauth_endpoints: sandbox when API root URL contains
     * 'sandbox' or AUTO_ADS_EBAY_SANDBOX is truthy.
     */

    const root = (process.env.AUTO_ADS_EBAY_API_ROOT || "").toLowerCase();
    const flag = (process.env.AUTO_ADS_EBAY_SANDBOX || "").toLowerCase();
    return root.includes("sandbox") || flag === "1" || flag === "true" || flag === "yes";
}

// RESOLVE EBAY REFRESH TOKEN
async function resolveEbayRefreshToken(): Promise<string | null> {
    /**
     * Prefers AUTO_ADS_EBAY_REFRESH_TOKEN when set; otherwise uses the database
     * token from the shared OAuth flow (see Ice AI API ebay-connect).
     */

    const fromEnv = process.env.AUTO_ADS_EBAY_REFRESH_TOKEN?.trim();
    if (fromEnv) return fromEnv;
    return getEbayRefreshTokenFromIceAiDb();
}

// GET EBAY API CLIENT
export async function getEbayApiClient(): Promise<eBayApi> {
    /**
     * Builds an eBay REST client from AUTO_ADS_EBAY_* environment variables,
     * attaches the refresh token (env or ia.oauth_tokens from the Ice AI OAuth
     * callback), and refreshes once so the first API call uses a valid user
     * access token.
     */

    const appId = process.env.AUTO_ADS_EBAY_CLIENT_ID;
    const certId = process.env.AUTO_ADS_EBAY_CLIENT_SECRET;
    const devId = process.env.AUTO_ADS_EBAY_DEV_ID?.trim();
    const refreshToken = await resolveEbayRefreshToken();
    const marketplaceId = (process.env.AUTO_ADS_EBAY_MARKETPLACE_ID?.trim() ||
        eBayApi.MarketplaceId.EBAY_GB) as EbayMarketplaceId;

    if (!appId || !certId || !refreshToken) {
        throw new Error(
            "eBay is not configured: set AUTO_ADS_EBAY_CLIENT_ID and AUTO_ADS_EBAY_CLIENT_SECRET, " +
                "then obtain a refresh token via the Ice AI API GET /ebay-connect flow (tokens stored in ia.oauth_tokens), " +
                "or set AUTO_ADS_EBAY_REFRESH_TOKEN explicitly. Ensure ICE_AI_DATABASE_URL is set so the website can read oauth_tokens.",
        );
    }

    const contentLanguage =
        marketplaceId === eBayApi.MarketplaceId.EBAY_GB
            ? eBayApi.Locale.en_GB
            : eBayApi.Locale.en_US;

    const ebay = new eBayApi({
        appId,
        certId,
        ...(devId ? {devId} : {}),
        sandbox: ebayUseSandbox(),
        marketplaceId,
        contentLanguage,
        acceptLanguage: contentLanguage,
        scope: [...EBAY_SELL_SCOPES],
        autoRefreshToken: true,
    });

    ebay.OAuth2.setCredentials({
        refresh_token: refreshToken,
        access_token: "",
    });
    await ebay.OAuth2.refreshUserAccessToken();

    return ebay;
}
