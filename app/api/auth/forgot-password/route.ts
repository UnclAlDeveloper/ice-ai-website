import {NextRequest, NextResponse} from "next/server";
import {forgotPassword} from "@app/lib/cognitoClient";

// FORGOT PASSWORD HANDLER
export async function POST(request: NextRequest) {
    /* Initiates a password reset by requesting a verification code for the specified user. */

    try {
        const body = await request.json();
        const username = body.username as string | undefined;

        if (!username) {
            return NextResponse.json(
                {error: "Username is required"},
                {status: 400},
            );
        }

        await forgotPassword({
            Username: username,
        });

        return NextResponse.json({success: true}, {status: 200});
    } catch (error) {
        console.error("Cognito forgot password error", error);

        return NextResponse.json(
            {error: "If this account exists, a reset code has been sent"},
            {status: 200},
        );
    }
}


