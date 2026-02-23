'use client';

import React, { createContext, useContext } from 'react';
import { AppName } from '../utils/appNames';

interface AppNameContextType {
    /* Context type for app name state. */

    appName: AppName;
}

const AppNameContext = createContext<AppNameContextType | undefined>(undefined);

// APP NAME PROVIDER
export function AppNameProvider({ children, appName }: { children: React.ReactNode; appName: AppName }) {
    /* Provides app name context to all child components, ensuring consistent app name between server and client. */

    return (
        <AppNameContext.Provider value={{ appName }}>
            {children}
        </AppNameContext.Provider>
    );
}

// USE APP NAME
export function useAppName(): AppName {
    /* Hook to access app name from context. Falls back to IceAI if context is not available. */

    const context = useContext(AppNameContext);
    if (context === undefined) {
        // Fallback for components outside provider (shouldn't happen in normal flow)
        return AppName.IceAI;
    }
    return context.appName;
}

