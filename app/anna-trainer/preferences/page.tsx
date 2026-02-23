import {getServerSessionFromCookies} from "@app/lib/session";
import {getPreferredLanguages, getAllLanguages} from "./actions";
import PreferencesClient from "./PreferencesClient";

// PAGE
export default async function Page() {
    /**
     * Server component for the Anna Trainer language preferences page.
     * Fetches initial data and passes it to the client component for interactivity.
     */

    const session = await getServerSessionFromCookies();

    if (!session) {
        return (
            <>
                <h3>Preferences - Anna Trainer</h3>
                <p>You must be logged in to access this page.</p>
            </>
        );
    }

    const [preferredLanguages, allLanguages] = await Promise.all([
        getPreferredLanguages(),
        getAllLanguages(),
    ]);

    return (
        <PreferencesClient
            initialPreferredLanguages={preferredLanguages}
            allLanguages={allLanguages}
        />
    );
}
