import {NextRequest, NextResponse} from "next/server";
import {confirmForgotPassword} from "@app/lib/cognitoClient";

// CONFIRM FORGOT PASSWORD HANDLER
export async function POST(request: NextRequest) {
    /* Confirms a forgotten password reset using a verification code and sets the new password. */

    try {
        const body = await request.json();
        const username = body.username as string | undefined;
        const code = body.code as string | undefined;
        const newPassword = body.newPassword as string | undefined;

        if (!username || !code || !newPassword) {
            return NextResponse.json(
                {error: "Username, confirmation code, and new password are required"},
                {status: 400},
            );
        }

        await confirmForgotPassword({
            Username: username,
            ConfirmationCode: code,
            Password: newPassword,
        });

        return NextResponse.json({success: true}, {status: 200});
    } catch (error) {
        console.error("Cognito confirm forgot password error", error);

        return NextResponse.json(
            {error: "Unable to reset password"},
            {status: 400},
        );
    }
}


