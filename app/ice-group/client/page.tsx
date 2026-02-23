"use client"

import React from "react";
import {useSession} from "@app/lib/useSession";

// PAGE
export default function Page() {
    /* Client page for ice-ai application. Requires authentication and app group membership. */

    const {data: session, status} = useSession();

    return (
        <>
            <h3>Client - ice-ai</h3>
            {status === 'loading' ? (
                <p>Checking authentication...</p>
            ) : !session?.isAuthenticated ? (
                <p>You must be logged in to access this page.</p>
            ) : (
                <>
                    <p>Welcome, {session.user?.name || session.user?.email}!</p>
                    <p>This is a client component page for ice-ai.</p>
                </>
            )}
        </>
    );
}

