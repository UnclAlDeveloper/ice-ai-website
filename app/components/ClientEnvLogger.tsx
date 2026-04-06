'use client';

import * as React from 'react';

// CLIENT ENV LOGGER
type ClientEnvLoggerProps = {
    publicEnv: Record<string, string | undefined>;
};

export default function ClientEnvLogger({ publicEnv }: ClientEnvLoggerProps) {
    /* Logs the server-provided NEXT_PUBLIC_* snapshot in the browser console after mount. */

    // next does not expose a real process.env object on the client; props carry the snapshot
    React.useEffect(() => {
        console.log("[website] environment variables (client):", publicEnv);
    }, [publicEnv]);

    return null;
}
