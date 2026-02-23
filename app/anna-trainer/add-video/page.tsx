import {getServerSessionFromCookies} from "@app/lib/session";
import {getAllLanguages, getVideoStages} from "./actions";
import AddVideoClient from "./AddVideoClient";

// PAGE
export default async function Page() {
    /**
     * Server component for the Anna Trainer add video page.
     * Fetches available languages and video stages, then renders the client form.
     */

    const session = await getServerSessionFromCookies();

    if (!session) {
        return (
            <>
                <h3>Add Video - Anna Trainer</h3>
                <p>You must be logged in to access this page.</p>
            </>
        );
    }

    const [languages, stages] = await Promise.all([
        getAllLanguages(),
        getVideoStages(),
    ]);

    return (
        <AddVideoClient
            languages={languages}
            stages={stages}
            userId={session.user.userId}
        />
    );
}
