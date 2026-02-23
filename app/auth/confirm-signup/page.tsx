'use client';

import React, {FormEvent, useState} from "react";
import {Box, Button, Stack, TextField, Typography} from "@mui/material";
import {useRouter} from "next/navigation";
import AuthLayout from "@components/auth/AuthLayout";

// CONFIRM SIGNUP PAGE
export default function ConfirmSignupPage() {
    /* Confirmation page that verifies a new account using a code sent by Cognito. */

    const router = useRouter();
    const [username, setUsername] = useState("");
    const [code, setCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        // handle confirmation of signup
        event.preventDefault();

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/confirm-signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username,
                    code,
                }),
            });

            const json = await response.json();

            if (!response.ok) {
                setError(json.error ?? "Unable to confirm account");
                return;
            }

            // Navigate to login screen immediately after successful confirmation
            router.push("/auth/login");
            return;
        } catch (submitError) {
            console.error("Confirm signup error", submitError);
            setError("Unexpected error while confirming account");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            title="Confirm your account"
            subtitle="Enter the code sent to your email to complete registration."
        >
            <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <TextField
                        label="Email or username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        fullWidth
                        required
                    />
                    <TextField
                        label="Confirmation code"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        fullWidth
                        required
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
                        {submitting ? "Confirming..." : "Confirm account"}
                    </Button>
                    <Button
                        type="button"
                        variant="text"
                        onClick={() => router.push("/auth/login")}
                    >
                        Back to login
                    </Button>
                </Stack>
            </Box>
        </AuthLayout>
    );
}


