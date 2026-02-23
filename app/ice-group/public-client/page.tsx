"use client"

import React from "react";
import {useSession} from "@app/lib/useSession";

// PAGE
export default function Page() {
    /* Public client page for ice-ai application. Accessible to everyone. */

    const {data: session, status} = useSession();

    return (
        <>
            <h3>Public Client - ice-ai</h3>
            {status === 'loading' ? (
                <p>Checking authentication...</p>
            ) : session?.isAuthenticated ? (
                <p>Welcome, {session.user?.name || session.user?.email}!</p>
            ) : (
                <p>You are not logged in.</p>
            )}
            <p>This is a public client component page for ice-ai.</p>
        </>
    );
}

