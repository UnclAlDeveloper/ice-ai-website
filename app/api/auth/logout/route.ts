import {NextRequest, NextResponse} from "next/server";
import {globalSignOut} from "@app/lib/cognitoClient";
import {clearSessionCookies, clearSessionCookiesOnResponse, getServerSessionFromCookies} from "@app/lib/session";

// LOGOUT HANDLER
export async function POST(_request: NextRequest) {
    /* Logs the current user out of both the application and Cognito, then clears all auth cookies. */

    console.log("[LOGOUT] Logout request received");

    try {
        const session = await getServerSessionFromCookies();
        console.log("[LOGOUT] Session found:", session ? "YES" : "NO");

        if (session?.tokens.accessToken) {
            try {
                console.log("[LOGOUT] Attempting Cognito global sign out");
                await globalSignOut({
                    AccessToken: session.tokens.accessToken,
                });
                console.log("[LOGOUT] Cognito global sign out successful");
            } catch (signOutError) {
                console.error("[LOGOUT] Cognito global sign out error", signOutError);
            }
        } else {
            console.log("[LOGOUT] No access token found, skipping Cognito sign out");
        }

        // Create response first
        const response = NextResponse.json({success: true}, {status: 200});
        
        // Clear cookies directly on the response object
        clearSessionCookiesOnResponse(response);
        
        // Also clear via cookies() API for compatibility
        await clearSessionCookies();
        
        // Verify cookies are cleared in response headers
        const setCookieHeaders = response.headers.getSetCookie();
        console.log("[LOGOUT] Set-Cookie headers in response:", setCookieHeaders.length);
        setCookieHeaders.forEach((cookie, index) => {
            console.log(`[LOGOUT] Set-Cookie ${index + 1}:`, cookie.substring(0, 80) + "...");
        });

        return response;
    } catch (error) {
        console.error("[LOGOUT] Logout error", error);

        // Create response first
        const response = NextResponse.json({success: true}, {status: 200});
        
        // Clear cookies directly on the response object
        clearSessionCookiesOnResponse(response);
        
        // Also clear via cookies() API for compatibility
        await clearSessionCookies();
        
        console.log("[LOGOUT] Returning response after error, cookies should be cleared");
        return response;
    }
}


