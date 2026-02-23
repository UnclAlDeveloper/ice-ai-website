'use client';

import {PropsWithChildren, useTransition} from "react";
import {Button} from "@mui/material";

// LOG OUT BUTTON
export function LogOutButton({children}: PropsWithChildren) {
    /* Button component that logs the user out via the custom Cognito logout endpoint and returns to home. */

    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        startTransition(async () => {
            try {
                await fetch("/api/auth/logout", {
                    method: "POST",
                    credentials: "include",
                });
            } finally {
                window.location.href = `${window.location.origin}/`;
            }
        });
    };

    return (
        <Button
            variant="text"
            type="button"
            onClick={handleClick}
            disabled={isPending}
        >
            {children}
        </Button>
    );
}

