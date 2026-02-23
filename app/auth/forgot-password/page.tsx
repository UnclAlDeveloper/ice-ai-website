'use client';

import React, {FormEvent, useState} from "react";
import {Box, Button, Stack, TextField, Typography} from "@mui/material";
import {useRouter} from "next/navigation";
import AuthLayout from "@components/auth/AuthLayout";

// FORGOT PASSWORD PAGE
export default function ForgotPasswordPage() {
    /* Page that initiates a password reset by requesting a reset code for the specified user. */

    const router = useRouter();
    const [username, setUsername] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        // handle forgot password request
        event.preventDefault();

        setSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username,
                }),
            });

            const json = await response.json();

            if (!response.ok) {
                setError(json.error ?? "Unable to initiate password reset");
                return;
            }

            // Navigate to reset-password page since they'll receive a code via email
            router.push("/auth/reset-password");
            return;
        } catch (submitError) {
            console.error("Forgot password error", submitError);
            setError("Unexpected error while initiating password reset");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            title="Forgot your password?"
            subtitle="Enter your email or username to receive a reset code."
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
                        {submitting ? "Sending code..." : "Send reset code"}
                    </Button>
                </Stack>
            </Box>
        </AuthLayout>
    );
}


