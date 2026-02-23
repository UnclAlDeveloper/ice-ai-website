'use client';

import React, {FormEvent, useState} from "react";
import {Box, Button, Stack, TextField, Typography} from "@mui/material";
import {useRouter} from "next/navigation";
import AuthLayout from "@components/auth/AuthLayout";

// RESET PASSWORD PAGE
export default function ResetPasswordPage() {
    /* Page that completes a password reset by submitting a reset code and new password. */

    const router = useRouter();
    const [username, setUsername] = useState("");
    const [code, setCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        // handle reset password confirmation
        event.preventDefault();

        if (newPassword !== confirmPassword) {
            setError("New password and confirmation do not match.");
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch("/api/auth/confirm-forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username,
                    code,
                    newPassword,
                }),
            });

            const json = await response.json();

            if (!response.ok) {
                setError(json.error ?? "Unable to reset password");
                return;
            }

            setSuccessMessage("Password has been reset. You can sign in now.");
        } catch (submitError) {
            console.error("Reset password error", submitError);
            setError("Unexpected error while resetting password");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            title="Reset your password"
            subtitle="Enter the code you received and choose a new password."
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
                        label="Reset code"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        fullWidth
                        required
                    />
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
                        {submitting ? "Resetting password..." : "Reset password"}
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


