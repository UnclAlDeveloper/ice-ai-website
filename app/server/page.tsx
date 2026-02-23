import React from "react";
import {getServerSessionFromCookies} from "@app/lib/session";
import {redirect} from "next/navigation";

// PAGE
export default async function Page() {
    /* Server page component that displays authentication status and requires a valid session. */
    
    console.log("Server");

    const session = await getServerSessionFromCookies();

    if (!session) {
        redirect("/");
    }

    return (
        <>
            <h3>Server</h3>
            {session ? <p>{session.user.name}</p> : <p>Not logged in</p>}
        </>
    );
}