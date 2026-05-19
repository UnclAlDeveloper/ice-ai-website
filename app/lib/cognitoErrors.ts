// COGNITO CONFIGURATION ERROR
export class CognitoConfigurationError extends Error {
    /* Thrown when the Cognito client cannot be constructed because required environment variables are missing or invalid. Having a dedicated class lets request handlers distinguish configuration problems from genuine authentication failures so that a misconfigured environment is never reported to the caller as bad credentials. */

    constructor(message: string) {
        super(message);
        this.name = "CognitoConfigurationError";
    }
}

// COGNITO ERROR CLASSIFICATION
export type CognitoErrorClassification = {
    /* Normalised representation of a Cognito or AWS SDK error suitable for returning from a route handler. */

    status: number;
    code: string;
    userMessage: string;
    details: string;
};

// CLASSIFY COGNITO ERROR
export function classifyCognitoError(error: unknown): CognitoErrorClassification {
    /* Maps an error thrown by the Cognito client or AWS SDK to an HTTP status, a machine-readable code, a safe user-facing message, and the underlying error details. Distinguishes genuine credential failures (401) from client validation problems (400), throttling (429), and configuration or infrastructure errors (500) so that misconfiguration never masquerades as bad credentials. */

    // narrow unknown to the loose shape AWS SDK v3 errors expose - both name and __type can carry the Cognito error code
    const err = error as {
        name?: string;
        message?: string;
        __type?: string;
        $metadata?: { httpStatusCode?: number };
    };
    const code = err.name ?? err.__type ?? "UnknownError";
    const details = err.message ?? "Unknown error";

    // configuration errors are thrown locally before any network call so they cannot be auth failures
    if (error instanceof CognitoConfigurationError) {
        return {
            status: 500,
            code: "CognitoConfigurationError",
            userMessage: "Authentication service is misconfigured. Please contact support.",
            details,
        };
    }

    // genuine credential failures - safe to map to 401 with a generic message that does not leak user existence
    if (code === "NotAuthorizedException" || code === "UserNotFoundException") {
        return {
            status: 401,
            code,
            userMessage: "Invalid username or password.",
            details,
        };
    }

    // valid credentials but the account is in a state that requires user action before sign-in can complete
    if (code === "UserNotConfirmedException") {
        return {
            status: 401,
            code,
            userMessage: "Your account is not confirmed. Please check your email for the verification code.",
            details,
        };
    }
    if (code === "PasswordResetRequiredException") {
        return {
            status: 401,
            code,
            userMessage: "A password reset is required. Please reset your password to continue.",
            details,
        };
    }

    // client validation failures - surface the underlying message where it is safe to do so
    if (code === "InvalidParameterException") {
        return {
            status: 400,
            code,
            userMessage: details,
            details,
        };
    }
    if (code === "InvalidPasswordException") {
        return {
            status: 400,
            code,
            userMessage: "Password does not meet the security requirements.",
            details,
        };
    }
    if (code === "CodeMismatchException" || code === "ExpiredCodeException") {
        return {
            status: 400,
            code,
            userMessage: "The verification code is invalid or has expired.",
            details,
        };
    }
    if (code === "UsernameExistsException") {
        return {
            status: 400,
            code,
            userMessage: "An account with this email already exists.",
            details,
        };
    }

    // throttling - clients should back off rather than retry immediately
    if (
        code === "TooManyRequestsException" ||
        code === "TooManyFailedAttemptsException" ||
        code === "LimitExceededException"
    ) {
        return {
            status: 429,
            code,
            userMessage: "Too many attempts. Please wait a moment and try again.",
            details,
        };
    }

    // infrastructure or unknown SDK errors - return 5xx so monitoring picks them up rather than hiding them behind a 401
    return {
        status: 500,
        code,
        userMessage: "Authentication service is temporarily unavailable. Please try again shortly.",
        details,
    };
}
