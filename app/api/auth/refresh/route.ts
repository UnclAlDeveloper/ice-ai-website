import {NextRequest, NextResponse} from "next/server";
import {initiateAuth} from "@app/lib/cognitoClient";
import {classifyCognitoError} from "@app/lib/cognitoErrors";
import {
    SessionPayload,
    createSessionCookies,
    decodeIdToken,
    getRefreshTokenFromCookies,
} from "@app/lib/session";

// REFRESH SESSION HANDLER
export async function POST(_request: NextRequest) {
    /* Refreshes the current session using the Cognito refresh token stored in the HTTP-only cookie. */

    try {
        const refreshToken = await getRefreshTokenFromCookies();

        if (!refreshToken) {
            return NextResponse.json(
                {error: "No refresh token available"},
                {status: 401},
            );
        }

        const response = await initiateAuth({
            AuthFlow: "REFRESH_TOKEN_AUTH",
            AuthParameters: {
                REFRESH_TOKEN: refreshToken,
            },
        });

        if (!response.AuthenticationResult?.IdToken || !response.AuthenticationResult.AccessToken) {
            return NextResponse.json(
                {error: "Unable to refresh session"},
                {status: 401},
            );
        }

        const idToken = response.AuthenticationResult.IdToken;
        const accessToken = response.AuthenticationResult.AccessToken;
        const user = decodeIdToken(idToken);

        const payload: SessionPayload = {
            user,
            tokens: {
                idToken,
                accessToken,
                refreshToken,
            },
            expiresAt: Math.floor(Date.now() / 1000) + (response.AuthenticationResult.ExpiresIn ?? 3600),
        };

        await createSessionCookies(payload, {rememberMe: true});

        return NextResponse.json(
            {
                user,
                groups: user.groups,
                expiresAt: payload.expiresAt,
            },
            {status: 200},
        );
    } catch (error) {
        // always log the full error server-side so misconfiguration and infrastructure issues surface in monitoring
        console.error("Cognito refresh error", error);

        // classify the error so a stale refresh token still returns 401 but config or infrastructure failures return 5xx
        const {status, code, userMessage, details} = classifyCognitoError(error);

        // refresh failures should present a refresh-specific message rather than the generic auth one
        const refreshMessage = status === 401 ? "Unable to refresh session" : userMessage;

        return NextResponse.json(
            {
                error: refreshMessage,
                code,
                details,
            },
            {status},
        );
    }
}


