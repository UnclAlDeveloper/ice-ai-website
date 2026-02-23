'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export interface ClientSession {
    /* Client-side session representation with authentication status, user data, groups, and expiration. */

    isAuthenticated: boolean;
    user: {
        userId: string;
        email?: string;
        name?: string;
        groups: string[];
    } | null;
    groups: string[];
    expiresAt: number | null;
}

interface SessionContextType {
    /* Context type for session state including session data, loading status, and refetch function. */

    data: ClientSession | null;
    status: "loading" | "authenticated" | "unauthenticated";
    refetch: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType>({
    data: null,
    status: "loading",
    refetch: async () => {},
});

interface SessionProviderProps {
    /* Props for SessionProvider component including children and optional initial session data. */

    children: React.ReactNode;
    initialSession?: ClientSession | null;
}

// SESSION PROVIDER
export function SessionProvider({ children, initialSession = null }: SessionProviderProps) {
    /* Provides session context to all child components. Uses server-provided initial session and only refetches on demand or focus. */

    const [data, setData] = useState<ClientSession | null>(initialSession);
    const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">(
        initialSession?.isAuthenticated ? "authenticated" : 
        initialSession === null ? "loading" : "unauthenticated"
    );
    const isFetchingRef = useRef(false);
    const lastBlurTimeRef = useRef<number>(0);
    const hasInitialSession = useRef(initialSession !== null);

    const loadSession = useCallback(async (force: boolean = false) => {
        if (isFetchingRef.current) return;

        // skip fetch if we have a valid session that hasn't expired
        if (!force && data?.expiresAt && Date.now() < data.expiresAt * 1000 - 60000) {
            return;
        }

        isFetchingRef.current = true;
        try {
            const response = await fetch("/api/auth/session", {
                method: "GET",
                credentials: "include",
                cache: "no-store",
            });

            if (!response.ok) {
                setData(null);
                setStatus("unauthenticated");
                return;
            }

            const json = (await response.json()) as ClientSession;
            setData(json);
            setStatus(json.isAuthenticated ? "authenticated" : "unauthenticated");
        } catch (error) {
            console.error("Failed to load session", error);
            setData(null);
            setStatus("unauthenticated");
        } finally {
            isFetchingRef.current = false;
        }
    }, [data?.expiresAt]);

    useEffect(() => {
        // only fetch on mount if we don't have an initial session from the server
        if (!hasInitialSession.current) {
            loadSession(true);
        } else {
            // mark as not loading if we have initial session
            if (status === "loading" && initialSession !== null) {
                setStatus(initialSession.isAuthenticated ? "authenticated" : "unauthenticated");
            }
        }

        const handleBlur = () => {
            lastBlurTimeRef.current = Date.now();
        };

        const handleFocus = () => {
            // only refetch if window was blurred for more than 5 minutes
            const blurDuration = Date.now() - lastBlurTimeRef.current;
            if (lastBlurTimeRef.current > 0 && blurDuration > 5 * 60 * 1000) {
                loadSession();
            }
        };

        window.addEventListener("blur", handleBlur);
        window.addEventListener("focus", handleFocus);
        return () => {
            window.removeEventListener("blur", handleBlur);
            window.removeEventListener("focus", handleFocus);
        };
    }, [loadSession, status, initialSession]);

    return (
        <SessionContext.Provider value={{ data, status, refetch: () => loadSession(true) }}>
            {children}
        </SessionContext.Provider>
    );
}

// USE SESSION
export function useSession() {
    /* Hook to access session data from context. */

    return useContext(SessionContext);
}

