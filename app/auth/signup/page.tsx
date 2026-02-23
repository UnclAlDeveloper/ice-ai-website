'use client';

import React, {FormEvent, useState} from "react";
import {Box, Button, Stack, TextField, Typography} from "@mui/material";
import {useRouter} from "next/navigation";
import AuthLayout from "@components/auth/AuthLayout";

// SIGNUP PAGE
export default function SignupPage() {
    /* Sign-up page that creates a new Cognito user and prompts for confirmation when required. */

    const router = useRouter();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        // handle sign up form submission and call signup api route
        event.preventDefault();

        if (password !== confirmPassword) {
            setError("Password and confirmation do not match.");
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: email,
                    password,
                    attributes: {
                        email,
                        preferred_username: username,
                    },
                }),
            });

            console.log(response);

            const json = await response.json();

            if (!response.ok) {
                const apiError =
                    (json && (json.error as string | undefined)) ||
                    (json && (json.details as string | undefined));

                setError(apiError ?? "Unable to create account.");
                return;
            }

            if (json.userConfirmed) {
                setSuccessMessage("Account created. You can sign in now.");
            } else {
                // Navigate to confirm-signup page since they'll receive a code via email
                router.push("/auth/confirm-signup");
                return;
            }
        } catch (submitError) {
            console.error("Signup error", submitError);
            setError("Unexpected error while creating account");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            title="Create an account"
            subtitle="Use your email address to register."
        >
            <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <TextField
                        label="Username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        fullWidth
                        autoComplete="username"
                        required
                    />
                    <TextField
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
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
                        autoComplete="new-password"
                        required
                    />
                    <TextField
                        label="Confirm password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        fullWidth
                        autoComplete="new-password"
                        required
                    />
                    {error && (
                        <Typography color="error" variant="body2">
                            {error}
                        </Typography>
                    )}
                    {successMessage && (
                        <Typography color="success.main" variant="body2">
                            {successMessage}
                        </Typography>
                    )}
                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={submitting}
                        fullWidth
                    >
                        {submitting ? "Creating account..." : "Sign up"}
                    </Button>
                </Stack>
            </Box>
        </AuthLayout>
    );
}


