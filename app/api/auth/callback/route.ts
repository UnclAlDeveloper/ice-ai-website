import {NextRequest, NextResponse} from "next/server";
import {getCognitoConfig} from "@app/lib/cognitoClient";
import {SessionPayload, createSessionCookies, decodeIdToken} from "@app/lib/session";

// SOCIAL CALLBACK HANDLER
export async function GET(request: NextRequest) {
    /* Handles the OAuth2 authorization code callback from Cognito and creates the local session cookies. */

    const {domain, clientId, clientSecret} = getCognitoConfig();

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const origin = url.origin;

    if (!code) {
        return NextResponse.redirect(`${origin}/login`);
    }

    const tokenEndpoint = new URL("/oauth2/token", domain);

    const body = new URLSearchParams();

    body.set("grant_type", "authorization_code");
    body.set("client_id", clientId);
    body.set("redirect_uri", `${origin}/api/auth/callback`);
    body.set("code", code);

    if (clientSecret) {
        body.set("client_secret", clientSecret);
    }

    const response = await fetch(tokenEndpoint.toString(), {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });

    if (!response.ok) {
        return NextResponse.redirect(`${origin}/login`);
    }

    const json = (await response.json()) as {
        id_token?: string;
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
    };

    if (!json.id_token || !json.access_token) {
        return NextResponse.redirect(`${origin}/login`);
    }

    const user = decodeIdToken(json.id_token);

    const payload: SessionPayload = {
        user,
        tokens: {
            idToken: json.id_token,
            accessToken: json.access_token,
            refreshToken: json.refresh_token,
        },
        expiresAt: Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600),
    };

    await createSessionCookies(payload, {rememberMe: true});

    return NextResponse.redirect(origin);
}


