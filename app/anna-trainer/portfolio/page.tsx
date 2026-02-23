import React from "react";
import {getServerSessionFromCookies} from "@app/lib/session";

// PAGE
export default async function Page() {
    /* Public server page for Anna Trainer application. Accessible to everyone. */

    const session = await getServerSessionFromCookies();

    return (
        <>
            <h3>Public Server - Anna Trainer</h3>
            {session ? (
                <p>Welcome, {session.user.name || session.user.email}!</p>
            ) : (
                <p>You are not logged in.</p>
            )}
            <p>This is a public server component page for Anna Trainer.</p>
        </>
    );
}

