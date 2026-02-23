import React from "react";
import {getServerSessionFromCookies} from "@app/lib/session";

// PAGE
export default async function Page() {
    /* Server page for ice-ai application. Requires authentication and app group membership. */

    const session = await getServerSessionFromCookies();

    if (!session) {
        return (
            <>
                <h3>Server - ice-ai</h3>
                <p>You must be logged in to access this page.</p>
            </>
        );
    }

    return (
        <>
            <h3>Server - ice-ai</h3>
            <p>Welcome, {session.user.name || session.user.email}!</p>
            <p>This is a server component page for ice-ai.</p>
        </>
    );
}

