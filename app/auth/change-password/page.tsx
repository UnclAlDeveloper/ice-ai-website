'use client';

import React, {FormEvent, useState} from "react";
import {Box, Button, Stack, TextField, Typography} from "@mui/material";
import {useRouter} from "next/navigation";
import AuthLayout from "@components/auth/AuthLayout";

// CHANGE PASSWORD PAGE
export default function ChangePasswordPage() {
    /* Page that lets an authenticated user change their password using the current and new passwords. */

    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        // handle change password form submission
        event.preventDefault();

        if (newPassword !== confirmPassword) {
            setError("New password and confirmation do not match.");
            return;
        }

        setSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
                credentials: "include",
            });

            const json = await response.json();

            if (!response.ok) {
                setError(json.error ?? "Unable to change password");
                return;
            }

            setSuccessMessage("Password changed successfully.");
        } catch (submitError) {
            console.error("Change password error", submitError);
            setError("Unexpected error while changing password");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            title="Change your password"
            subtitle="Enter your current password and choose a new one."
        >
            <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <TextField
                        label="Current password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        fullWidth
                        autoComplete="current-password"
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
                        {submitting ? "Changing password..." : "Change password"}
                    </Button>
                    <Button
                        type="button"
                        variant="text"
                        onClick={() => router.push("/")}
                    >
                        Back to home
                    </Button>
                </Stack>
            </Box>
        </AuthLayout>
    );
}


