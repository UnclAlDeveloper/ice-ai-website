'use client';

import React, {FormEvent, useEffect, useState} from "react";
import {Box, Button, Stack, TextField, Typography} from "@mui/material";
import {useRouter} from "next/navigation";
import AuthLayout from "@components/auth/AuthLayout";

interface StoredChallenge {
    /* Structure for storing NEW_PASSWORD_REQUIRED challenge data in session storage. */

    username: string;
    session: string;
    rememberMe: boolean;
}

// NEW PASSWORD PAGE
export default function NewPasswordPage() {
    /* Page that completes a NEW_PASSWORD_REQUIRED challenge by collecting and submitting a new password. */

    const router = useRouter();
    const [challenge, setChallenge] = useState<StoredChallenge | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // load stored new password challenge from session storage
        const raw = sessionStorage.getItem("ua_new_password_challenge");

        if (!raw) {
            setChallenge(null);
            return;
        }

        try {
            const parsed = JSON.parse(raw) as StoredChallenge;
            setChallenge(parsed);
        } catch {
            setChallenge(null);
        }
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        // submit new password to complete the cognito challenge
        event.preventDefault();

        if (!challenge) {
            setError("Password change session is missing. Please log in again.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("New password and confirmation do not match.");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/complete-new-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: challenge.username,
                    newPassword,
                    session: challenge.session,
                    rememberMe: challenge.rememberMe,
                }),
            });

            const json = await response.json();

            if (!response.ok) {
                setError(json.error ?? "Unable to update password");
                return;
            }

            sessionStorage.removeItem("ua_new_password_challenge");
            window.location.href = "/";
        } catch (submitError) {
            console.error("Complete new password error", submitError);
            setError("Unexpected error while updating password");
        } finally {
            setSubmitting(false);
        }
    };

    if (!challenge) {
        return (
            <AuthLayout
                title="Password change required"
                subtitle="Your password change session has expired. Please sign in again."
            >
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => router.push("/auth/login")}
                >
                    Go to login
                </Button>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Set a new password"
            subtitle="Your account requires a new password before you can continue."
        >
            <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <TextField
                        label="New password"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        fullWidth
                        autoComplete="new-password"
                        required
                    />
                    <TextField
                        label="Confirm new password"
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
                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={submitting}
                        fullWidth
                    >
                        {submitting ? "Updating password..." : "Update password"}
                    </Button>
                </Stack>
            </Box>
        </AuthLayout>
    );
}


