import type {Metadata} from "next";
import { headers } from 'next/headers';
import './ui/fonts'
import "./globals.css";
import Registry from './registry';
import ThemeWrapper from './ui/ThemeWrapper';
import ThemeBodyStyles from './ui/ThemeBodyStyles';
import BackgroundWrapper from './ui/BackgroundWrapper';
import ThemedContainer from './ui/ThemedContainer';
import { getAppNameFromHostname, AppFriendlyNames, AppIcons } from './utils/appNames';
import { SessionProvider } from './lib/SessionProvider';
import { getServerSessionFromCookies } from './lib/session';
import AppBarServer from '@components/AppBarServer';
import ClientEnvLogger from '@components/ClientEnvLogger';

// GENERATE METADATA
export async function generateMetadata(): Promise<Metadata> {
    /* Generates page metadata including title and icons based on the hostname-derived app name. */

    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const appName = getAppNameFromHostname(host);
    const appFriendlyName = AppFriendlyNames[appName];
    const iconPath = AppIcons[appName];

    return {
        title: appFriendlyName,
        icons: {
            icon: iconPath,
            shortcut: iconPath,
            apple: iconPath,
        },
    };
}

// ROOT LAYOUT
export default async function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    /* Root layout component that wraps the entire application with theming and main container. Uses RSC to fetch session server-side. */

    const session = await getServerSessionFromCookies();
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const appName = getAppNameFromHostname(host);
    const pathname = headersList.get('x-pathname') || '/';
    const isAuthRoute = pathname.startsWith('/auth');

    // serialize session for client (exclude sensitive tokens)
    const clientSession = session ? {
        isAuthenticated: true,
        user: session.user,
        groups: session.user?.groups || [],
        expiresAt: session.expiresAt,
    } : null;

    // next strips non-static process.env from the client bundle; pass public vars from the server
    const publicEnvForClient = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key.startsWith("NEXT_PUBLIC_")),
    );
    
    return (
        <html lang="en" style={{ colorScheme: 'light' }}>
        <body>
        <ClientEnvLogger publicEnv={publicEnvForClient} />
        <script
            dangerouslySetInnerHTML={{
                __html: `
                    // Guard against window.ethereum access errors on mobile devices
                    if (typeof window !== 'undefined' && !window.ethereum) {
                        window.ethereum = {
                            selectedAddress: null
                        };
                    }
                `,
            }}
        />
        <Registry>
            <SessionProvider initialSession={clientSession}>
                <ThemeWrapper appName={appName}>
                    <ThemeBodyStyles />
                    <BackgroundWrapper>
                        <ThemedContainer isAuthRoute={isAuthRoute} appBar={<AppBarServer />}>
                            {children}
                        </ThemedContainer>
                    </BackgroundWrapper>
                </ThemeWrapper>
            </SessionProvider>
        </Registry>
        </body>
        </html>
    );
}
