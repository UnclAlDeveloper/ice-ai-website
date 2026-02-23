import {
    AdminAddUserToGroupCommand,
    AdminAddUserToGroupCommandInput,
    AdminInitiateAuthCommand,
    AdminInitiateAuthCommandInput,
    AdminRespondToAuthChallengeCommand,
    AdminRespondToAuthChallengeCommandInput,
    ChangePasswordCommand,
    ChangePasswordCommandInput,
    CognitoIdentityProviderClient,
    ConfirmForgotPasswordCommand,
    ConfirmForgotPasswordCommandInput,
    ConfirmSignUpCommand,
    ConfirmSignUpCommandInput,
    DescribeUserPoolCommand,
    ForgotPasswordCommand,
    ForgotPasswordCommandInput,
    GlobalSignOutCommand,
    GlobalSignOutCommandInput,
    InitiateAuthCommand,
    InitiateAuthCommandInput,
    RespondToAuthChallengeCommand,
    RespondToAuthChallengeCommandInput,
    SignUpCommand,
    SignUpCommandInput,
    UpdateUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {STSClient, GetCallerIdentityCommand} from "@aws-sdk/client-sts";
import {SESClient, GetIdentityVerificationAttributesCommand, GetSendQuotaCommand} from "@aws-sdk/client-ses";
import {createHmac} from "crypto";

// COGNITO CLIENT
export function createCognitoClient() {
    /* Creates a CognitoIdentityProviderClient configured for the current AWS region. Relies on the standard AWS credential provider chain (ECS task role, environment, etc.). */

    const region = process.env.COGNITO_REGION || process.env.AWS_REGION_NAME;

    if (!region) {
        throw new Error("COGNITO_REGION or AWS_REGION_NAME must be configured");
    }

    return new CognitoIdentityProviderClient({region});
}

// COGNITO CONFIG
export function getCognitoConfig() {
    /* Returns the core Cognito configuration derived from environment variables. These values are required for all Cognito interactions. */

    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.AUTH_COGNITO_ID;
    const clientSecret = process.env.AUTH_COGNITO_SECRET;
    const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "https://auth.uncl-al.com";

    if (!userPoolId || !clientId) {
        throw new Error("COGNITO_USER_POOL_ID and AUTH_COGNITO_ID must be configured");
    }

    return {
        userPoolId,
        clientId,
        clientSecret,
        domain,
    };
}

// SECRET HASH
function calculateSecretHash(username: string, clientId: string, clientSecret?: string) {
    /* Calculates the Cognito secret hash for app clients that are configured with a client secret. Returns undefined when no client secret is configured. */

    if (!clientSecret) {
        return undefined;
    }

    const hmac = createHmac("sha256", clientSecret);
    hmac.update(username + clientId);

    return hmac.digest("base64");
}

// SIGN UP USER
export async function signUpUser(input: Omit<SignUpCommandInput, "ClientId">) {
    /**
     * Signs up a new Cognito user using the configured user pool client.
     */

    const client = createCognitoClient();
    const {clientId, clientSecret} = getCognitoConfig();

    const username = input.Username ?? "";
    const secretHash = calculateSecretHash(username, clientId, clientSecret);

    const command = new SignUpCommand({
        ...input,
        ClientId: clientId,
        ...(secretHash ? {SecretHash: secretHash} : {}),
    });

    return client.send(command);
}

// CONFIRM SIGN UP
export async function confirmUserSignUp(input: Omit<ConfirmSignUpCommandInput, "ClientId">) {
    /* Confirms a newly registered Cognito user using a verification code. */

    const client = createCognitoClient();
    const {clientId, clientSecret} = getCognitoConfig();

    const username = input.Username ?? "";
    const secretHash = calculateSecretHash(username, clientId, clientSecret);

    const command = new ConfirmSignUpCommand({
        ...input,
        ClientId: clientId,
        ...(secretHash ? {SecretHash: secretHash} : {}),
    });

    return client.send(command);
}

// INITIATE AUTH
export async function initiateAuth(input: Omit<InitiateAuthCommandInput, "ClientId">) {
    /**
     * Initiates a standard USER_PASSWORD_AUTH or REFRESH_TOKEN_AUTH flow against Cognito.
     */

    const client = createCognitoClient();
    const {clientId, clientSecret} = getCognitoConfig();

    const username = input.AuthParameters?.USERNAME ?? "";
    const secretHash = username
        ? calculateSecretHash(username, clientId, clientSecret)
        : undefined;

    const command = new InitiateAuthCommand({
        ...input,
        ClientId: clientId,
        AuthParameters: {
            ...input.AuthParameters,
            ...(secretHash ? {SECRET_HASH: secretHash} : {}),
        },
    });

    return client.send(command);
}

// RESPOND TO AUTH CHALLENGE
export async function respondToAuthChallenge(input: Omit<RespondToAuthChallengeCommandInput, "ClientId">) {
    /* Responds to an authentication challenge such as NEW_PASSWORD_REQUIRED or MFA. */

    const client = createCognitoClient();
    const {clientId, clientSecret} = getCognitoConfig();

    const username = input.ChallengeResponses?.USERNAME ?? "";
    const secretHash = username
        ? calculateSecretHash(username, clientId, clientSecret)
        : undefined;

    const command = new RespondToAuthChallengeCommand({
        ...input,
        ClientId: clientId,
        ...(secretHash ? {SecretHash: secretHash} : {}),
    });

    return client.send(command);
}

// ADMIN INITIATE AUTH
export async function adminInitiateAuth(input: Omit<AdminInitiateAuthCommandInput, "UserPoolId" | "ClientId">) {
    /**
     * Initiates an administrative authentication flow, used when the backend has AWS credentials.
     */

    const client = createCognitoClient();
    const {userPoolId, clientId} = getCognitoConfig();

    const command = new AdminInitiateAuthCommand({
        ...input,
        UserPoolId: userPoolId,
        ClientId: clientId,
    });

    return client.send(command);
}

// ADMIN RESPOND TO AUTH CHALLENGE
export async function adminRespondToAuthChallenge(
    input: Omit<AdminRespondToAuthChallengeCommandInput, "UserPoolId" | "ClientId">,
) {
    /* Responds to an admin authentication challenge such as NEW_PASSWORD_REQUIRED. */

    const client = createCognitoClient();
    const {userPoolId, clientId, clientSecret} = getCognitoConfig();

    const username = input.ChallengeResponses?.USERNAME ?? "";
    const secretHash = username
        ? calculateSecretHash(username, clientId, clientSecret)
        : undefined;

    const command = new AdminRespondToAuthChallengeCommand({
        ...input,
        UserPoolId: userPoolId,
        ClientId: clientId,
        ChallengeResponses: {
            ...input.ChallengeResponses,
            ...(secretHash ? {SECRET_HASH: secretHash} : {}),
        },
    });

    return client.send(command);
}

// FORGOT PASSWORD
export async function forgotPassword(input: Omit<ForgotPasswordCommandInput, "ClientId">) {
    /**
     * Initiates a password reset for an existing Cognito user.
     */

    const client = createCognitoClient();
    const {clientId, clientSecret} = getCognitoConfig();

    const username = input.Username ?? "";
    const secretHash = calculateSecretHash(username, clientId, clientSecret);

    const command = new ForgotPasswordCommand({
        ...input,
        ClientId: clientId,
        ...(secretHash ? {SecretHash: secretHash} : {}),
    });

    return client.send(command);
}

// CONFIRM FORGOT PASSWORD
export async function confirmForgotPassword(input: Omit<ConfirmForgotPasswordCommandInput, "ClientId">) {
    /* Confirms a password reset using the verification code sent to the user. */

    const client = createCognitoClient();
    const {clientId, clientSecret} = getCognitoConfig();

    const username = input.Username ?? "";
    const secretHash = calculateSecretHash(username, clientId, clientSecret);

    const command = new ConfirmForgotPasswordCommand({
        ...input,
        ClientId: clientId,
        ...(secretHash ? {SecretHash: secretHash} : {}),
    });

    return client.send(command);
}

// CHANGE PASSWORD
export async function changePassword(input: ChangePasswordCommandInput) {
    /* Changes the password for an authenticated Cognito user using their access token. */

    const client = createCognitoClient();

    const command = new ChangePasswordCommand(input);

    return client.send(command);
}

// GLOBAL SIGN OUT
export async function globalSignOut(input: GlobalSignOutCommandInput) {
    /* Globally signs a user out from all devices using their access token. */

    const client = createCognitoClient();

    const command = new GlobalSignOutCommand(input);

    return client.send(command);
}

// ADMIN ADD USER TO GROUP
export async function adminAddUserToGroup(input: Omit<AdminAddUserToGroupCommandInput, "UserPoolId">) {
    /**
     * Adds a Cognito user to the specified group within the configured user pool.
     */

    const client = createCognitoClient();
    const {userPoolId} = getCognitoConfig();

    const command = new AdminAddUserToGroupCommand({
        ...input,
        UserPoolId: userPoolId,
    });

    return client.send(command);
}

// CHECK SES IDENTITY VERIFICATION STATUS
async function checkSESIdentityVerification(fromEmail: string, region: string): Promise<void> {
    /* Checks the verification status of an SES email identity and logs diagnostic information. */

    try {
        const sesClient = new SESClient({region});
        const verificationCommand = new GetIdentityVerificationAttributesCommand({
            Identities: [fromEmail],
        });
        const verificationResponse = await sesClient.send(verificationCommand);

        const verificationAttributes = verificationResponse.VerificationAttributes?.[fromEmail];
        
        if (!verificationAttributes) {
            console.error(`[SES DIAGNOSTIC] Email identity '${fromEmail}' not found in SES region ${region}. Identity may not be verified.`);
            console.error(`[SES DIAGNOSTIC] Action required: Verify '${fromEmail}' in SES console (region: ${region})`);
        } else {
            const verificationStatus = verificationAttributes.VerificationStatus;
            console.log(`[SES DIAGNOSTIC] Email identity '${fromEmail}' verification status: ${verificationStatus}`);
            
            if (verificationStatus !== 'Success') {
                console.error(`[SES DIAGNOSTIC] Email identity '${fromEmail}' is not verified. Current status: ${verificationStatus}`);
                console.error(`[SES DIAGNOSTIC] Action required: Complete verification for '${fromEmail}' in SES console (region: ${region})`);
            } else {
                console.log(`[SES DIAGNOSTIC] Email identity '${fromEmail}' is verified and ready to send emails`);
            }
        }

        // check sending quota
        try {
            const quotaCommand = new GetSendQuotaCommand({});
            const quotaResponse = await sesClient.send(quotaCommand);
            console.log(`[SES DIAGNOSTIC] SES sending quota - Max 24h send: ${quotaResponse.Max24HourSend}, Max send rate: ${quotaResponse.MaxSendRate} emails/second`);
            console.log(`[SES DIAGNOSTIC] SES sending quota - Sent in last 24h: ${quotaResponse.SentLast24Hours}`);
            
            if (quotaResponse.Max24HourSend && quotaResponse.SentLast24Hours) {
                const usagePercent = (quotaResponse.SentLast24Hours / quotaResponse.Max24HourSend) * 100;
                if (usagePercent > 80) {
                    console.warn(`[SES DIAGNOSTIC] WARNING: SES quota usage is ${usagePercent.toFixed(2)}% - approaching limit`);
                }
            }
        } catch (quotaError: any) {
            console.warn(`[SES DIAGNOSTIC] Could not retrieve SES quota information:`, quotaError.message);
        }
    } catch (sesError: any) {
        console.error(`[SES DIAGNOSTIC] Error checking SES identity verification:`, {
            errorCode: sesError.name,
            errorMessage: sesError.message,
            region,
            fromEmail,
        });
    }
}

// CHECK USER POOL EMAIL CONFIGURATION
async function checkUserPoolEmailConfiguration(userPoolId: string, client: CognitoIdentityProviderClient): Promise<void> {
    /* Checks and logs the current User Pool email configuration to diagnose SES setup issues. */

    try {
        const describeCommand = new DescribeUserPoolCommand({UserPoolId: userPoolId});
        const describeResponse = await client.send(describeCommand);
        const emailConfig = describeResponse.UserPool?.EmailConfiguration;

        if (!emailConfig) {
            console.error(`[COGNITO DIAGNOSTIC] User Pool ${userPoolId} has no email configuration`);
            return;
        }

        console.log(`[COGNITO DIAGNOSTIC] User Pool email configuration:`, {
            EmailSendingAccount: emailConfig.EmailSendingAccount,
            From: emailConfig.From,
            ReplyToEmailAddress: emailConfig.ReplyToEmailAddress,
            SourceArn: emailConfig.SourceArn,
            ConfigurationSet: emailConfig.ConfigurationSet,
        });

        if (emailConfig.EmailSendingAccount !== 'DEVELOPER') {
            console.error(`[COGNITO DIAGNOSTIC] WARNING: EmailSendingAccount is '${emailConfig.EmailSendingAccount}', expected 'DEVELOPER' for SES`);
        }

        if (!emailConfig.SourceArn) {
            console.warn(`[COGNITO DIAGNOSTIC] WARNING: SourceArn is not set. This may be required for SES email sending.`);
        }

        if (!emailConfig.From) {
            console.error(`[COGNITO DIAGNOSTIC] ERROR: From email address is not configured`);
        }
    } catch (describeError: any) {
        console.error(`[COGNITO DIAGNOSTIC] Error checking User Pool email configuration:`, {
            errorCode: describeError.name,
            errorMessage: describeError.message,
            userPoolId,
        });
    }
}

// UPDATE USER POOL EMAIL VERIFICATION MESSAGE
export async function updateUserPoolEmailVerificationMessage(appFriendlyName: string) {
    /* Updates the Cognito User Pool email verification message template to include the app-friendly name. This ensures that emails sent to users include the correct app name. Also configures SES email sending with the appropriate "from" address and SourceArn based on the region. Includes comprehensive diagnostic logging. */

    const client = createCognitoClient();
    const {userPoolId} = getCognitoConfig();

    // determine the region to set the correct SES "from" email address
    const region = process.env.COGNITO_REGION || process.env.AWS_REGION_NAME || 'us-east-2';
    let fromEmail: string;
    
    if (region === 'eu-west-2') {
        fromEmail = 'noreply@ice-group.ai';
    } else {
        // default to uncl-al for us-east-2 or any other region
        fromEmail = 'noreply@uncl-al.com';
    }

    console.log(`[EMAIL CONFIG] Starting email configuration update for User Pool: ${userPoolId}`);
    console.log(`[EMAIL CONFIG] Region: ${region}, From email: ${fromEmail}`);

    // check SES identity verification status before proceeding
    await checkSESIdentityVerification(fromEmail, region);

    // get AWS account ID to construct SES identity ARN
    let sourceArn: string | undefined;
    let accountId: string | undefined;
    try {
        const stsClient = new STSClient({region});
        const identityCommand = new GetCallerIdentityCommand({});
        const identityResponse = await stsClient.send(identityCommand);
        
        if (identityResponse.Account) {
            accountId = identityResponse.Account;
            // SES identity ARN format: arn:aws:ses:REGION:ACCOUNT_ID:identity/EMAIL_ADDRESS
            sourceArn = `arn:aws:ses:${region}:${accountId}:identity/${fromEmail}`;
            console.log(`[EMAIL CONFIG] Constructed SES SourceArn: ${sourceArn}`);
        }
    } catch (stsError: any) {
        // log error but continue - SourceArn might not be required if CDK already configured it
        console.warn(`[EMAIL CONFIG] Failed to get AWS account ID for SES SourceArn:`, {
            errorCode: stsError.name,
            errorMessage: stsError.message,
        });
    }

    const emailConfig: any = {
        EmailSendingAccount: 'DEVELOPER',
        From: fromEmail,
        ReplyToEmailAddress: fromEmail,
    };

    // include SourceArn if we were able to construct it
    if (sourceArn) {
        emailConfig.SourceArn = sourceArn;
    }

    console.log(`[EMAIL CONFIG] Updating User Pool with email configuration:`, {
        EmailSendingAccount: emailConfig.EmailSendingAccount,
        From: emailConfig.From,
        ReplyToEmailAddress: emailConfig.ReplyToEmailAddress,
        SourceArn: emailConfig.SourceArn || 'not set',
    });

    const command = new UpdateUserPoolCommand({
        UserPoolId: userPoolId,
        EmailConfiguration: emailConfig,
        VerificationMessageTemplate: {
            EmailSubject: `Verify your ${appFriendlyName} account`,
            EmailMessage: `Hello,

Thank you for signing up for ${appFriendlyName}. Your verification code is {####}.

If you didn't request this code, you can safely ignore this email.`,
        },
    });

    try {
        const response = await client.send(command);
        console.log(`[EMAIL CONFIG] Successfully updated User Pool email configuration`);

        // verify the configuration was applied correctly
        await checkUserPoolEmailConfiguration(userPoolId, client);

        return response;
    } catch (updateError: any) {
        console.error(`[EMAIL CONFIG] Failed to update User Pool email configuration:`, {
            errorCode: updateError.name,
            errorMessage: updateError.message,
            userPoolId,
            emailConfig,
        });
        throw updateError;
    }
}


