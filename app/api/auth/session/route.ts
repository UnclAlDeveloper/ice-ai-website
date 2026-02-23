import {NextRequest, NextResponse} from "next/server";
import {getServerSessionFromCookies} from "@app/lib/session";

// SESSION HANDLER
export async function GET(_request: NextRequest) {
    /* Returns a sanitized snapshot of the current authenticated session for client-side consumption. */

    // Debug: Log all cookies received
    const cookieHeader = _request.headers.get("cookie");
    console.log("[SESSION] Cookie header received:", cookieHeader ? "present" : "missing");
    if (cookieHeader) {
        console.log("[SESSION] Cookie header value:", cookieHeader.substring(0, 100) + "...");
    }

    const session = await getServerSessionFromCookies();
    console.log("[SESSION] Session found:", session ? "YES" : "NO", session ? `user: ${session.user.userId}` : "");

    if (!session) {
        return NextResponse.json(
            {
                isAuthenticated: false,
                user: null,
                groups: [],
                expiresAt: null,
            },
            {status: 200},
        );
    }

    return NextResponse.json(
        {
            isAuthenticated: true,
            user: session.user,
            groups: session.user.groups,
            expiresAt: session.expiresAt,
        },
        {status: 200},
    );
}


