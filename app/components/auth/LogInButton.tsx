'use client';

import {PropsWithChildren, useTransition} from "react";
import {Button, Typography, useTheme} from "@mui/material";
import {useRouter} from "next/navigation";

// LOG IN BUTTON
export function LogInButton({children}: PropsWithChildren) {
    /* Button component that navigates to the custom login page for Cognito authentication and renders its label from children. */

    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const theme = useTheme();

    const handleClick = () => {
        startTransition(async () => {
            const origin = window.location.origin;
            router.push(`${origin}/auth/login`);
        });
    };

    return (
        <Button
            variant="text"
            type="button"
            onClick={handleClick}
            disabled={isPending}
        >
            <Typography color={theme.custom.loginButtonColour}>
            {children}
            </Typography>
        </Button>
    );
}
