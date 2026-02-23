"use server";

import {annaTrainerDb} from "@app/lib/annaTrainerDb";
import {getServerSessionFromCookies} from "@app/lib/session";
import {revalidatePath} from "next/cache";
import {preferredLanguages, languages} from "../../../drizzle/anna-trainer/schema";
import {eq, inArray, and, asc} from "drizzle-orm";

// GET PREFERRED LANGUAGES
export async function getPreferredLanguages() {
    /**
     * Fetches the current user's preferred languages from the database.
     * Returns an array of preferred language records with their associated language details.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        throw new Error("Not authenticated");
    }

    const result = await annaTrainerDb.query.preferredLanguages.findMany({
        where: eq(preferredLanguages.owner, session.user.userId),
        with: {language: true},
    });

    // sort by language name
    result.sort((a, b) => a.language.language.localeCompare(b.language.language));

    return result;
}

// GET ALL LANGUAGES
export async function getAllLanguages() {
    /**
     * Fetches all available languages from the database.
     * Returns an array of language records sorted alphabetically by name.
     */

    const result = await annaTrainerDb.query.languages.findMany({
        orderBy: [asc(languages.language)],
    });

    return result;
}

// SAVE PREFERRED LANGUAGES
export async function savePreferredLanguages(
    languageCodesToAdd: string[],
    idsToDelete: number[],
) {
    /**
     * Saves changes to the user's preferred languages.
     * Creates new preferred language records and deletes removed ones in a transaction.
     * Returns the updated list of preferred languages.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        throw new Error("Not authenticated");
    }

    const userId = session.user.userId;

    await annaTrainerDb.transaction(async (tx) => {
        // delete removed languages
        if (idsToDelete.length > 0) {
            await tx
                .delete(preferredLanguages)
                .where(
                    and(
                        eq(preferredLanguages.owner, userId),
                        inArray(preferredLanguages.id, idsToDelete),
                    ),
                );
        }

        // create new preferred languages
        if (languageCodesToAdd.length > 0) {
            await tx.insert(preferredLanguages).values(
                languageCodesToAdd.map((code) => ({
                    languageCode: code,
                    owner: userId,
                })),
            );
        }
    });

    revalidatePath("/anna-trainer/preferences");

    // return fresh data with real database IDs
    const updatedPreferences = await annaTrainerDb.query.preferredLanguages.findMany({
        where: eq(preferredLanguages.owner, userId),
        with: {language: true},
    });

    // sort by language name
    updatedPreferences.sort((a, b) => a.language.language.localeCompare(b.language.language));

    return updatedPreferences;
}
