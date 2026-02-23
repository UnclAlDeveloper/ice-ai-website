import {NextRequest, NextResponse} from "next/server";
import {adminAddUserToGroup, signUpUser, updateUserPoolEmailVerificationMessage} from "@app/lib/cognitoClient";
import {AppFriendlyNames, getAppNameFromHostname} from "@app/utils/appNames";

// SIGNUP HANDLER
export async function POST(request: NextRequest) {
    /* Registers a new Cognito user using the supplied username, password, and attributes. */

    try {
        const body = await request.json();
        const username = body.username as string | undefined;
        const password = body.password as string | undefined;
        const attributes = (body.attributes as Record<string, string> | undefined) ?? {};

        if (!username || !password) {
            return NextResponse.json(
                {error: "Username and password are required"},
                {status: 400},
            );
        }

        const enrichedAttributes: Record<string, string> = {
            ...attributes,
        };

        if (!enrichedAttributes["preferred_username"]) {
            enrichedAttributes["preferred_username"] = username;
        }

        // Get hostname from request headers (more reliable than request.url)
        const hostname = request.headers.get('host') || new URL(request.url).hostname;
        const appName = getAppNameFromHostname(hostname);
        const appFriendlyName = AppFriendlyNames[appName];

        console.log(`Signup request for hostname: ${hostname}, resolved appName: ${appName}, username: ${username}`);

        const userAttributes = Object.entries(enrichedAttributes).map(
            ([Name, Value]) => ({
                Name,
                Value,
            }),
        );

        // log recipient email for diagnostics
        const recipientEmail = username; // username is the email address
        console.log(`[SIGNUP] Attempting to create user with email: ${recipientEmail}`);
        console.log(`[SIGNUP] App context: ${appName} (${appFriendlyName})`);

        const response = await signUpUser({
            Username: username,
            Password: password,
            UserAttributes: userAttributes,
            ClientMetadata: {
                appName: appName,
            },
        });

        const userSub = response.UserSub;
        const userConfirmed = response.UserConfirmed ?? false;
        const codeDeliveryDetails = response.CodeDeliveryDetails;

        console.log(`[SIGNUP] User created successfully:`, {
            userSub,
            username,
            userConfirmed,
            codeDeliveryDetails: codeDeliveryDetails ? {
                destination: codeDeliveryDetails.Destination,
                deliveryMedium: codeDeliveryDetails.DeliveryMedium,
                attributeName: codeDeliveryDetails.AttributeName,
            } : 'not provided',
        });

        // check if email delivery details are present
        if (!codeDeliveryDetails) {
            console.warn(`[SIGNUP] WARNING: CodeDeliveryDetails not present in signup response. Email may not have been sent.`);
        } else {
            console.log(`[SIGNUP] Email delivery details:`, {
                destination: codeDeliveryDetails.Destination,
                deliveryMedium: codeDeliveryDetails.DeliveryMedium,
                attributeName: codeDeliveryDetails.AttributeName,
            });

            if (codeDeliveryDetails.Destination !== recipientEmail) {
                console.warn(`[SIGNUP] WARNING: Email destination '${codeDeliveryDetails.Destination}' does not match recipient '${recipientEmail}'`);
            }
        }

        // Update email template with app-friendly name
        try {
            console.log(`[SIGNUP] Updating email verification message template...`);
            await updateUserPoolEmailVerificationMessage(appFriendlyName);
            console.log(`[SIGNUP] Successfully updated email verification message template`);
        } catch (emailTemplateError: any) {
            // Log but don't fail signup if email template update fails
            const errorMessage = emailTemplateError?.message || String(emailTemplateError);
            const errorCode = emailTemplateError?.name || 'UnknownError';
            console.error(`[SIGNUP] Failed to update email template:`, {
                errorCode,
                errorMessage,
                recipientEmail,
                fullError: emailTemplateError,
            });
        }

        // log final signup status
        console.log(`[SIGNUP] Signup process completed:`, {
            userSub,
            username: recipientEmail,
            userConfirmed,
            emailSent: !!codeDeliveryDetails,
        });

        const groupAssignmentResults: Record<string, { success: boolean; error?: string }> = {};

        if (userSub) {
            // Add user to app-specific group
            try {
                console.log(`Attempting to add user ${username} (${userSub}) to group ${appName}...`);
                await adminAddUserToGroup({
                    Username: username,
                    GroupName: appName,
                });
                console.log(`Successfully added user ${username} (${userSub}) to group ${appName}`);
                groupAssignmentResults[appName] = { success: true };
            } catch (groupError: any) {
                const errorMessage = groupError?.message || String(groupError);
                const errorCode = groupError?.name || 'UnknownError';
                const errorDetails = {
                    errorCode,
                    errorMessage,
                    username,
                    userSub,
                    groupName: appName,
                    fullError: groupError,
                };
                console.error(`Failed to add user ${username} (${userSub}) to group ${appName}:`, errorDetails);
                groupAssignmentResults[appName] = { 
                    success: false, 
                    error: `${errorCode}: ${errorMessage}` 
                };
            }

            // Add user to FreeTier group
            try {
                console.log(`Attempting to add user ${username} (${userSub}) to group FreeTier...`);
                await adminAddUserToGroup({
                    Username: username,
                    GroupName: "FreeTier",
                });
                console.log(`Successfully added user ${username} (${userSub}) to group FreeTier`);
                groupAssignmentResults["FreeTier"] = { success: true };
            } catch (groupError: any) {
                const errorMessage = groupError?.message || String(groupError);
                const errorCode = groupError?.name || 'UnknownError';
                const errorDetails = {
                    errorCode,
                    errorMessage,
                    username,
                    userSub,
                    groupName: "FreeTier",
                    fullError: groupError,
                };
                console.error(`Failed to add user ${username} (${userSub}) to group FreeTier:`, errorDetails);
                groupAssignmentResults["FreeTier"] = { 
                    success: false, 
                    error: `${errorCode}: ${errorMessage}` 
                };
            }
        } else {
            console.error(`UserSub is missing from signup response for username: ${username}`);
        }

        return NextResponse.json(
            {
                userConfirmed: response.UserConfirmed ?? false,
                userSub: response.UserSub,
                groupAssignments: groupAssignmentResults,
            },
            {status: 200},
        );
    } catch (error) {
        console.error("Cognito signup error", error);

        const err = error as { name?: string; message?: string };
        const code = err.name ?? "UnknownError";
        const rawMessage = err.message ?? "Unknown signup error";

        let userMessage = "Unable to sign up user.";

        if (code === "UsernameExistsException") {
            userMessage = "An account with this email already exists.";
        } else if (code === "InvalidPasswordException") {
            userMessage = "Password does not meet the security requirements.";
        } else if (code === "InvalidParameterException") {
            // surface the underlying Cognito message directly for clearer feedback
            userMessage = rawMessage;
        }

        return NextResponse.json(
            {
                error: userMessage,
                code,
                details: rawMessage,
            },
            {status: 400},
        );
    }
}


