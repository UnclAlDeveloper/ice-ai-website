import { headers } from 'next/headers';
import { Suspense } from 'react';
import { getServerSessionFromCookies } from '@app/lib/session';
import { getAppNameFromHostname } from '@app/utils/appNames';
import { getMenuItemsForApp } from '@app/lib/menuUtils';
import AppBarClient from './AppBarClient';
import AppBarSkeleton from './AppBarSkeleton';

// APP BAR SERVER
export default async function AppBarServer() {
    /* React Server Component that computes menu items and auth state server-side, then passes serializable props to the client component. */

    const session = await getServerSessionFromCookies();
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const pathname = headersList.get('x-pathname') || '/';
    const appName = getAppNameFromHostname(host);

    const userGroups = session?.user?.groups || [];
    const isAuthenticated = !!session;
    const menuItems = getMenuItemsForApp(appName, userGroups, isAuthenticated);

    return (
        <Suspense fallback={<AppBarSkeleton />}>
            <AppBarClient
                menuItems={menuItems}
                initialAuth={{
                    isAuthenticated,
                    userName: session?.user?.name || session?.user?.email || null,
                }}
                appName={appName}
                pathname={pathname}
            />
        </Suspense>
    );
}
