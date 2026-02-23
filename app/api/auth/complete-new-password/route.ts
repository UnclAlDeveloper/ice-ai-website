import {NextRequest, NextResponse} from "next/server";
import {adminRespondToAuthChallenge} from "@app/lib/cognitoClient";
import {SessionPayload, createSessionCookies, decodeIdToken} from "@app/lib/session";

// COMPLETE NEW PASSWORD HANDLER
export async function POST(request: NextRequest) {
    /* Completes a NEW_PASSWORD_REQUIRED challenge by setting a new password and issuing session cookies. */

    try {
        const body = await request.json();
        const username = body.username as string | undefined;
        const newPassword = body.newPassword as string | undefined;
        const sessionToken = body.session as string | undefined;
        const rememberMe = Boolean(body.rememberMe);

        if (!username || !newPassword || !sessionToken) {
            return NextResponse.json(
                {error: "Username, session, and new password are required"},
                {status: 400},
            );
        }

        const response = await adminRespondToAuthChallenge({
            ChallengeName: "NEW_PASSWORD_REQUIRED",
            Session: sessionToken,
            ChallengeResponses: {
                USERNAME: username,
                NEW_PASSWORD: newPassword,
            },
        });

        if (!response.AuthenticationResult?.IdToken || !response.AuthenticationResult.AccessToken) {
            return NextResponse.json(
                {error: "Unable to complete password change"},
                {status: 400},
            );
        }

        const idToken = response.AuthenticationResult.IdToken;
        const accessToken = response.AuthenticationResult.AccessToken;
        const refreshToken = response.AuthenticationResult.RefreshToken;
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

        await createSessionCookies(payload, {rememberMe});

        return NextResponse.json(
            {
                user,
                groups: user.groups,
                expiresAt: payload.expiresAt,
            },
            {status: 200},
        );
    } catch (error) {
        console.error("Cognito complete new password error", error);

        return NextResponse.json(
            {error: "Unable to complete required password change"},
            {status: 400},
        );
    }
}


