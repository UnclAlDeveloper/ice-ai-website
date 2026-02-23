import {NextRequest, NextResponse} from "next/server";
import {confirmUserSignUp} from "@app/lib/cognitoClient";

// CONFIRM SIGNUP HANDLER
export async function POST(request: NextRequest) {
    /* Confirms a newly registered Cognito user using a verification code. */

    try {
        const body = await request.json();
        const username = body.username as string | undefined;
        const code = body.code as string | undefined;

        if (!username || !code) {
            return NextResponse.json(
                {error: "Username and confirmation code are required"},
                {status: 400},
            );
        }

        await confirmUserSignUp({
            Username: username,
            ConfirmationCode: code,
        });

        return NextResponse.json({success: true}, {status: 200});
    } catch (error) {
        console.error("Cognito confirm signup error", error);

        return NextResponse.json(
            {error: "Unable to confirm sign up"},
            {status: 400},
        );
    }
}


