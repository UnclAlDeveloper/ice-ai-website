import {NextRequest, NextResponse} from "next/server";
import {getCognitoConfig} from "@app/lib/cognitoClient";

// SOCIAL AUTH HANDLER
export async function GET(request: NextRequest) {
    /* Redirects the browser to the Cognito hosted UI for a selected social identity provider. */

    const {domain, clientId} = getCognitoConfig();

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const provider = searchParams.get("provider") ?? "";

    const origin = url.origin;
    const redirectUri = `${origin}/api/auth/callback`;

    const authorizeUrl = new URL("/oauth2/authorize", domain);

    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", "openid email profile");

    if (provider) {
        authorizeUrl.searchParams.set("identity_provider", provider);
    }

    return NextResponse.redirect(authorizeUrl.toString());
}


