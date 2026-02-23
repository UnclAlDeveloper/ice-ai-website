"use client"

import React from "react";
import {useSession} from "@app/lib/useSession";

// PAGE
export default function Page() {
    /* Client page component that displays authentication status. */
    
    console.log("Client")

    const {data: session, status} = useSession();

    return (
        <>
            <h3>Client</h3>
            {status === 'loading' ? (
                <p>Checking authentication...</p>
            ) : session?.isAuthenticated ? (
                <p>{session.user?.name ?? session.user?.email}</p>
            ) : (
                <p>Not logged in</p>
            )}
        </>
    );
}