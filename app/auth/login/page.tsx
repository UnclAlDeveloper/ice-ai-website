'use client';

import React, {FormEvent, useState} from "react";
import {Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography} from "@mui/material";
import {useRouter, useSearchParams} from "next/navigation";
import AuthLayout from "@components/auth/AuthLayout";

// Return path is safe for redirect (relative, no protocol-relative or external URLs)
function isSafeReturnTo(returnTo: string | null): boolean {
    if (!returnTo || typeof returnTo !== "string") return false;
    const s = returnTo.trim();
    return s.startsWith("/") && !s.startsWith("//");
}

// LOGIN PAGE
export default function LoginPage() {
    /* Login page that authenticates a user against Cognito and supports a remember-me option. */

    const router = useRouter();
    const searchParams = useSearchParams();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const returnTo = searchParams.get("returnTo");
    const redirectAfterLogin = isSafeReturnTo(returnTo) ? returnTo! : "/";

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        // handle form submission and call the login api route
        event.preventDefault();

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    username,
                    password,
                    rememberMe,
                }),
            });

            let json: any;
            try {
                json = await response.json();
            } catch (jsonError) {
                // If response isn't JSON, it might be an HTML error page or empty
                console.error("Failed to parse response as JSON", jsonError);
                setError(`Server error (${response.status}): ${response.statusText}`);
                return;
            }

            if (!response.ok) {
                setError(json.error ?? json.message ?? "Unable to log in");
                return;
            }

            if (json.challengeName === "NEW_PASSWORD_REQUIRED" && json.session) {
                sessionStorage.setItem(
                    "ua_new_password_challenge",
                    JSON.stringify({
                        username,
                        session: json.session as string,
                        rememberMe,
                    }),
                );
                router.push("/auth/new-password");
                return;
            }

            // Small delay to ensure cookies are processed before redirect
            await new Promise(resolve => setTimeout(resolve, 100));
            window.location.href = redirectAfterLogin;
        } catch (submitError) {
            console.error("Login error", submitError);
            const errorMessage = submitError instanceof Error ? submitError.message : "Unexpected error while logging in";
            setError(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            title="Sign in"
            subtitle="Enter your credentials to continue."
        >
            <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <TextField
                        label="Email"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        fullWidth
                        autoComplete="email"
                        required
                    />
                    <TextField
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        fullWidth
                        autoComplete="current-password"
                        required
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={rememberMe}
                                onChange={(event) => setRememberMe(event.target.checked)}
                                color="primary"
                            />
                        }
                        label="Remember me"
                    />
                    {error && (
                        <Typography color="error" variant="body2">
                            {error}
                        </Typography>
                    )}
                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={submitting}
                        fullWidth
                    >
                        {submitting ? "Signing in..." : "Sign in"}
                    </Button>
                    <Stack
                        direction="row"
                        spacing={2}
                        justifyContent="space-between"
                    >
                        <Button
                            type="button"
                            variant="text"
                            onClick={() => router.push("/auth/signup")}
                        >
                            Create account
                        </Button>
                        <Button
                            type="button"
                            variant="text"
                            onClick={() => router.push("/auth/forgot-password")}
                        >
                            Forgot password?
                        </Button>
                    </Stack>
                </Stack>
            </Box>
        </AuthLayout>
    );
}


