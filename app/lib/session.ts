import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {JWTPayload, SignJWT, decodeJwt, jwtVerify} from "jose";

interface SessionTokens {
    /* Contains the Cognito authentication tokens for a user session. */

    idToken: string;
    accessToken: string;
    refreshToken?: string;
}

export interface SessionUser {
    /* Represents the core user identity extracted from a Cognito ID token, including groups. */

    userId: string;
    email?: string;
    name?: string;
    groups: string[];
}

export interface SessionPayload {
    /* Complete session data including user identity, authentication tokens, and expiration time. */

    user: SessionUser;
    tokens: SessionTokens;
    expiresAt: number;
}

const SESSION_COOKIE_NAME = "ua_session";
const SESSION_REFRESH_COOKIE_NAME = "ua_session_refresh";

// SESSION SECRET
function getSessionSecret(): Uint8Array {
    /* Returns the session secret used to sign and verify session JWT payloads. Falls back to AUTH_SECRET or NEXTAUTH_SECRET for backwards compatibility. */

    const secret =
        process.env.SESSION_SECRET ||
        process.env.AUTH_SECRET ||
        process.env.NEXTAUTH_SECRET;

    if (!secret) {
        throw new Error("SESSION_SECRET or AUTH_SECRET must be configured");
    }

    return new TextEncoder().encode(secret);
}

// DECODE ID TOKEN
export function decodeIdToken(idToken: string): SessionUser {
    /**
     * Decodes a Cognito ID token to extract core user identity fields and group membership.
     */

    const decoded = decodeJwt(idToken) as JWTPayload;

    const sub = typeof decoded.sub === "string" ? decoded.sub : "";
    const email = typeof decoded.email === "string" ? decoded.email : undefined;

    const preferredUsername = typeof decoded["preferred_username"] === "string"
        ? (decoded["preferred_username"] as string)
        : undefined;

    const name =
        preferredUsername ||
        (typeof decoded.name === "string" ? decoded.name : undefined);

    const rawGroups = decoded["cognito:groups"];
    const groups =
        Array.isArray(rawGroups) && rawGroups.every((g) => typeof g === "string")
            ? (rawGroups as string[])
            : [];

    return {
        userId: sub,
        email,
        name,
        groups,
    };
}

// CREATE SESSION COOKIES
export async function createSessionCookies(
    payload: SessionPayload,
    options: {rememberMe: boolean},
) {
    /* Serializes the session payload into HTTP-only cookies. Uses a short-lived cookie for the main session and a longer-lived cookie for refresh semantics. */

    const secret = getSessionSecret();
    const now = Math.floor(Date.now() / 1000);

    const accessExpirySeconds = 60 * 60;
    const refreshExpirySeconds = options.rememberMe ? 60 * 60 * 24 * 14 : 60 * 60 * 8;

    const sessionJwt = await new SignJWT({
        user: payload.user,
        tokens: {
            idToken: payload.tokens.idToken,
            accessToken: payload.tokens.accessToken,
        },
    })
        .setProtectedHeader({alg: "HS256"})
        .setIssuedAt(now)
        .setExpirationTime(now + accessExpirySeconds)
        .sign(secret);

    const refreshJwt = payload.tokens.refreshToken
        ? await new SignJWT({
              refreshToken: payload.tokens.refreshToken,
          })
              .setProtectedHeader({alg: "HS256"})
              .setIssuedAt(now)
              .setExpirationTime(now + refreshExpirySeconds)
              .sign(secret)
        : null;

    const cookieStore = await cookies();
    // Only use secure cookies if explicitly enabled via environment variable
    // Default to false so cookies work over HTTP in development/staging
    const useSecure = process.env.FORCE_SECURE_COOKIES === "true";

    console.log("[COOKIES] Setting session cookie:", SESSION_COOKIE_NAME);
    console.log("[COOKIES] JWT length:", sessionJwt.length);
    console.log("[COOKIES] NODE_ENV:", process.env.NODE_ENV);
    console.log("[COOKIES] FORCE_SECURE_COOKIES:", process.env.FORCE_SECURE_COOKIES);
    console.log("[COOKIES] secure flag:", useSecure);

    try {
        cookieStore.set(SESSION_COOKIE_NAME, sessionJwt, {
            httpOnly: true,
            secure: useSecure,
            sameSite: "lax",
            path: "/",
            maxAge: accessExpirySeconds,
        });
        console.log("[COOKIES] Session cookie set successfully");
    } catch (error) {
        console.error("[COOKIES] Error setting session cookie:", error);
        throw error;
    }

    if (refreshJwt && payload.tokens.refreshToken) {
        console.log("[COOKIES] Setting refresh cookie:", SESSION_REFRESH_COOKIE_NAME);
        try {
            cookieStore.set(SESSION_REFRESH_COOKIE_NAME, refreshJwt, {
                httpOnly: true,
                secure: useSecure,
                sameSite: "lax",
                path: "/",
                maxAge: refreshExpirySeconds,
            });
            console.log("[COOKIES] Refresh cookie set successfully");
        } catch (error) {
            console.error("[COOKIES] Error setting refresh cookie:", error);
            throw error;
        }
    } else {
        console.log("[COOKIES] No refresh token to set");
    }
}

// CREATE SESSION COOKIES ON RESPONSE
export async function createSessionCookiesOnResponse(
    response: NextResponse,
    payload: SessionPayload,
    options: {rememberMe: boolean},
) {
    /**
     * Sets session cookies directly on a NextResponse object.
     * This ensures cookies are properly attached to the response headers.
     */

    const secret = getSessionSecret();
    const now = Math.floor(Date.now() / 1000);

    const accessExpirySeconds = 60 * 60;
    const refreshExpirySeconds = options.rememberMe ? 60 * 60 * 24 * 14 : 60 * 60 * 8;

    const sessionJwt = await new SignJWT({
        user: payload.user,
        tokens: {
            idToken: payload.tokens.idToken,
            accessToken: payload.tokens.accessToken,
        },
    })
        .setProtectedHeader({alg: "HS256"})
        .setIssuedAt(now)
        .setExpirationTime(now + accessExpirySeconds)
        .sign(secret);

    const refreshJwt = payload.tokens.refreshToken
        ? await new SignJWT({
              refreshToken: payload.tokens.refreshToken,
          })
              .setProtectedHeader({alg: "HS256"})
              .setIssuedAt(now)
              .setExpirationTime(now + refreshExpirySeconds)
              .sign(secret)
        : null;

    // Only use secure cookies if explicitly enabled via environment variable
    // Default to false so cookies work over HTTP in development/staging
    const useSecure = process.env.FORCE_SECURE_COOKIES === "true";

    console.log("[COOKIES] Setting session cookie on response:", SESSION_COOKIE_NAME);
    console.log("[COOKIES] JWT length:", sessionJwt.length);
    console.log("[COOKIES] NODE_ENV:", process.env.NODE_ENV);
    console.log("[COOKIES] FORCE_SECURE_COOKIES:", process.env.FORCE_SECURE_COOKIES);
    console.log("[COOKIES] HTTPS:", process.env.HTTPS);
    console.log("[COOKIES] secure flag:", useSecure);

    // Set cookies directly on the response object
    response.cookies.set(SESSION_COOKIE_NAME, sessionJwt, {
        httpOnly: true,
        secure: useSecure,
        sameSite: "lax",
        path: "/",
        maxAge: accessExpirySeconds,
    });
    console.log("[COOKIES] Session cookie set on response successfully");

    if (refreshJwt && payload.tokens.refreshToken) {
        console.log("[COOKIES] Setting refresh cookie on response:", SESSION_REFRESH_COOKIE_NAME);
        response.cookies.set(SESSION_REFRESH_COOKIE_NAME, refreshJwt, {
            httpOnly: true,
            secure: useSecure,
            sameSite: "lax",
            path: "/",
            maxAge: refreshExpirySeconds,
        });
        console.log("[COOKIES] Refresh cookie set on response successfully");
    } else {
        console.log("[COOKIES] No refresh token to set");
    }
}

// CREATE SESSION COOKIE HEADERS
export function createSessionCookieHeaders(
    payload: SessionPayload,
    options: {rememberMe: boolean},
): string[] {
    /* Creates Set-Cookie header strings for manual attachment to responses. Returns an array of Set-Cookie header strings. */

    const secret = getSessionSecret();
    const now = Math.floor(Date.now() / 1000);

    const accessExpirySeconds = 60 * 60;
    const refreshExpirySeconds = options.rememberMe ? 60 * 60 * 24 * 14 : 60 * 60 * 8;

    // Note: This function creates cookie strings but doesn't sign JWTs
    // We'll use the existing createSessionCookies for JWT signing
    // This is a helper for manual header attachment if needed
    const isProduction = process.env.NODE_ENV === "production";
    const secureFlag = isProduction ? "; Secure" : "";
    const sameSiteFlag = "; SameSite=Lax";

    const headers: string[] = [];
    
    // This function would need the JWT strings, so it's not fully useful
    // We'll keep using cookies().set() but ensure it's called correctly
    return headers;
}

// CLEAR SESSION COOKIES
export async function clearSessionCookies() {
    /* Clears both the main session and refresh cookies. Must use the same secure flag value that was used when setting the cookies. */

    const cookieStore = await cookies();
    // Use the same logic as when setting cookies - only secure if explicitly enabled
    const useSecure = process.env.FORCE_SECURE_COOKIES === "true";

    console.log("[LOGOUT] Clearing session cookies");
    console.log("[LOGOUT] secure flag:", useSecure);

    cookieStore.set(SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        secure: useSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    cookieStore.set(SESSION_REFRESH_COOKIE_NAME, "", {
        httpOnly: true,
        secure: useSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    console.log("[LOGOUT] Session cookies cleared");
}

// CLEAR SESSION COOKIES ON RESPONSE
export function clearSessionCookiesOnResponse(response: NextResponse) {
    /**
     * Clears session cookies directly on a NextResponse object.
     * This ensures cookies are properly cleared in the response headers.
     */

    // Use the same logic as when setting cookies - only secure if explicitly enabled
    const useSecure = process.env.FORCE_SECURE_COOKIES === "true";

    console.log("[LOGOUT] Clearing session cookies on response");
    console.log("[LOGOUT] secure flag:", useSecure);

    // Clear cookies by setting them to empty with maxAge 0
    response.cookies.set(SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        secure: useSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    response.cookies.set(SESSION_REFRESH_COOKIE_NAME, "", {
        httpOnly: true,
        secure: useSecure,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    console.log("[LOGOUT] Session cookies cleared on response");
}

// GET REFRESH TOKEN FROM COOKIES
export async function getRefreshTokenFromCookies(): Promise<string | null> {
    /* Reads and verifies the refresh token from the dedicated refresh cookie. Returns null if the cookie is missing or invalid. */

    const cookieStore = await cookies();
    const refreshCookie = cookieStore.get(SESSION_REFRESH_COOKIE_NAME);

    if (!refreshCookie?.value) {
        return null;
    }

    try {
        const secret = getSessionSecret();
        const {payload} = await jwtVerify(refreshCookie.value, secret);
        const refreshToken = payload.refreshToken;

        if (typeof refreshToken !== "string" || !refreshToken) {
            return null;
        }

        return refreshToken;
    } catch {
        return null;
    }
}

// GET SESSION FROM COOKIES
export async function getServerSessionFromCookies(): Promise<SessionPayload | null> {
    /* Reads and verifies the current session from HTTP-only cookies. Returns null if the session is missing or invalid. */

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    console.log("[SESSION] Looking for cookie:", SESSION_COOKIE_NAME);
    console.log("[SESSION] Cookie found:", sessionCookie ? "YES" : "NO");
    console.log("[SESSION] Cookie value present:", sessionCookie?.value ? "YES" : "NO");

    if (!sessionCookie?.value) {
        console.log("[SESSION] No session cookie found, returning null");
        return null;
    }

    try {
        const secret = getSessionSecret();
        const {payload} = await jwtVerify(sessionCookie.value, secret);

        const user = payload.user as SessionUser | undefined;
        const tokens = payload.tokens as Omit<SessionTokens, "refreshToken"> | undefined;

        if (!user || !tokens?.idToken || !tokens.accessToken) {
            return null;
        }

        const exp =
            typeof payload.exp === "number"
                ? payload.exp
                : Math.floor(Date.now() / 1000) + 60 * 60;

        return {
            user,
            tokens: {
                idToken: tokens.idToken,
                accessToken: tokens.accessToken,
            },
            expiresAt: exp,
        };
    } catch {
        return null;
    }
}

// REQUIRE AUTH
export async function requireAuth() {
    /* Helper that ensures a valid session is present. Throws an error if there is no authenticated user. */

    const session = await getServerSessionFromCookies();

    if (!session) {
        throw new Error("User is not authenticated");
    }

    return session;
}

// REQUIRE GROUP
export async function requireGroup(groupName: string) {
    /* Helper that ensures the authenticated user belongs to a specific Cognito group. */

    const session = await requireAuth();

    if (!session.user.groups.includes(groupName)) {
        throw new Error("User is not authorized for this resource");
    }

    return session;
}

