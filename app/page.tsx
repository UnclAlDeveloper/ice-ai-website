import { headers } from 'next/headers';
import { getAppNameFromHostname } from '@app/utils/appNames';
import HomePage from '@components/home/HomePage';

// HOME
export default async function Home() {
    /* Server component that detects the app name and renders the appropriate home page. */

    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const appName = getAppNameFromHostname(host);

    return <HomePage appName={appName} />;
}

