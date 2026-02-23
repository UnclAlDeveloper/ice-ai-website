import {NextRequest, NextResponse} from "next/server";
import {adminInitiateAuth, initiateAuth} from "@app/lib/cognitoClient";
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
        console.error("Cognito login error", error);

        // AWS SDK v3 errors can have the error name in different places
        const err = error as { name?: string; message?: string; __type?: string };
        const code = err.name ?? err.__type ?? "UnknownError";
        const rawMessage = err.message ?? "Unknown login error";

        let userMessage = "Invalid username or password.";

        if (code === "UserNotConfirmedException") {
            userMessage = "Your account is not confirmed. Please check your email for the verification code.";
        } else if (code === "NotAuthorizedException") {
            userMessage = "Invalid username or password.";
        } else if (code === "UserNotFoundException") {
            userMessage = "Invalid username or password.";
        }

        return NextResponse.json(
            {
                error: userMessage,
                code,
                details: rawMessage,
            },
            {status: 401},
        );
    }
}


