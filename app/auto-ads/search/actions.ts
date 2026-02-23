"use server";

import {autoAdsDb} from "@app/lib/autoAdsDb";
import {getServerSessionFromCookies} from "@app/lib/session";
import {revalidatePath} from "next/cache";
import {savedSearches} from "@/drizzle/auto-ads/schema";
import {eq, and, desc} from "drizzle-orm";

// GET SAVED SEARCHES
export async function getSavedSearches(): Promise<{id: number; query: string}[]> {
    /**
     * Fetches the current user's saved searches ordered by most recently used.
     * Returns an empty array if not authenticated.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return [];
    }

    const rows = await autoAdsDb
        .select({id: savedSearches.id, query: savedSearches.query})
        .from(savedSearches)
        .where(eq(savedSearches.userId, session.user.userId))
        .orderBy(desc(savedSearches.lastUsedAt));

    return rows;
}

// SAVE SEARCH
export async function saveSearch(query: string): Promise<void> {
    /**
     * Saves the given search for the current user. If a row already exists for
     * (user_id, query), updates last_used_at to now; otherwise inserts a new row.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        throw new Error("Not authenticated");
    }

    const trimmed = query.trim();
    if (!trimmed) {
        return;
    }

    const now = new Date().toISOString();

    await autoAdsDb
        .insert(savedSearches)
        .values({
            userId: session.user.userId,
            query: trimmed,
            lastUsedAt: now,
        })
        .onConflictDoUpdate({
            target: [savedSearches.userId, savedSearches.query],
            set: {lastUsedAt: now},
        });

    revalidatePath("/auto-ads/search");
}

// RECORD SAVED SEARCH USED
export async function recordSavedSearchUsed(id: number): Promise<void> {
    /**
     * Updates last_used_at to now for the given saved search id.
     * Only updates if the row belongs to the current user.
     */

    if (id == null || Number.isNaN(id)) {
        return;
    }

    const session = await getServerSessionFromCookies();
    if (!session) {
        throw new Error("Not authenticated");
    }

    await autoAdsDb
        .update(savedSearches)
        .set({lastUsedAt: new Date().toISOString()})
        .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, session.user.userId)));

    revalidatePath("/auto-ads/search");
}
