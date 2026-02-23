import {NextRequest, NextResponse} from "next/server";
import {changePassword} from "@app/lib/cognitoClient";
import {requireAuth} from "@app/lib/session";

// CHANGE PASSWORD HANDLER
export async function POST(request: NextRequest) {
    /* Changes the password for the currently authenticated user using their access token. */

    try {
        const body = await request.json();
        const currentPassword = body.currentPassword as string | undefined;
        const newPassword = body.newPassword as string | undefined;

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                {error: "Current and new passwords are required"},
                {status: 400},
            );
        }

        const session = await requireAuth();

        await changePassword({
            AccessToken: session.tokens.accessToken,
            PreviousPassword: currentPassword,
            ProposedPassword: newPassword,
        });

        return NextResponse.json({success: true}, {status: 200});
    } catch (error) {
        console.error("Cognito change password error", error);

        return NextResponse.json(
            {error: "Unable to change password"},
            {status: 400},
        );
    }
}


