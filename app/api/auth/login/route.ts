import {NextRequest, NextResponse} from "next/server";
import {initiateAuth} from "@app/lib/cognitoClient";
import {classifyCognitoError} from "@app/lib/cognitoErrors";
import {SessionPayload, createSessionCookiesOnResponse, decodeIdToken} from "@app/lib/session";

// LOGIN HANDLER
export async function POST(request: NextRequest) {
    /* Handles user login via Cognito using username, password, and an optional remember-me flag. */

    try {
        const body = await request.json();
        const username = body.username as string | undefined;
        const password = body.password as string | undefined;
        const rememberMe = Boolean(body.rememberMe);

        if (!username || !password) {
            return NextResponse.json(
                {error: "Username and password are required"},
                {status: 400},
            );
        }

        const response = await initiateAuth({
            AuthFlow: "USER_PASSWORD_AUTH",
            AuthParameters: {
                USERNAME: username,
                PASSWORD: password,
            },
        });

        if (response.ChallengeName && response.Session) {
            return NextResponse.json(
                {
                    challengeName: response.ChallengeName,
                    session: response.Session,
                    requiredAttributes: response.ChallengeParameters,
                },
                {status: 200},
            );
        }

        if (!response.AuthenticationResult?.IdToken || !response.AuthenticationResult.AccessToken) {
            return NextResponse.json(
                {error: "Authentication failed"},
                {status: 401},
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

        console.log("[LOGIN] Creating response for user:", user.userId, "email:", user.email);

        // Create the response FIRST
        const jsonResponse = NextResponse.json(
            {
                user,
                groups: user.groups,
                expiresAt: payload.expiresAt,
            },
            {status: 200},
        );

        // Set cookies directly on the response object
        await createSessionCookiesOnResponse(jsonResponse, payload, {rememberMe});

        // Verify cookies are attached by checking response headers
        const setCookieHeaders = jsonResponse.headers.getSetCookie();
        console.log("[LOGIN] Set-Cookie headers in response:", setCookieHeaders.length);
        setCookieHeaders.forEach((cookie, index) => {
            console.log(`[LOGIN] Set-Cookie ${index + 1}:`, cookie.substring(0, 50) + "...");
        });

        return jsonResponse;
    } catch (error) {
        // always log the full error server-side so misconfiguration and infrastructure issues surface in monitoring
        console.error("Cognito login error", error);

        // classify the error so config and infrastructure failures do not get returned as 401s
        const {status, code, userMessage, details} = classifyCognitoError(error);

        return NextResponse.json(
            {
                error: userMessage,
                code,
                details,
            },
            {status},
        );
    }
}


