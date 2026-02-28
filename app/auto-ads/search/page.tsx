import React, {Suspense} from "react";
import {getServerSessionFromCookies} from "@app/lib/session";
import {Typography, Box, Chip} from "@mui/material";
import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {prospectListings, images} from "@/drizzle/auto-ads/schema";
import {InferSelectModel, sql, and, or, eq, ilike, lte, gte, gt, desc, inArray, isNotNull, isNull} from "drizzle-orm";
import ErrorBar from "@components/ErrorBar";
import ProspectCard from "../components/ProspectCard";
import SearchInput from "./SearchInput";
import {getUserTier, compareTiers} from "@app/lib/menuUtils";
import {parseSearchQuery, SearchFilters} from "../lib/searchQueryParser";
import {buildDocumentText} from "../lib/buildDocumentText";

// PAGE CONSTANTS
const SQL_CANDIDATE_LIMIT = 100;
const TOP_K = 10;

// LOG MEM
function logMem(label: string): void {
    /**
     * Logs a checkpoint label with current heap memory usage in MiB.
     * Helps identify OOM issues in memory-constrained containers.
     */

    const mem = process.memoryUsage();
    console.log(`[SEARCH] ${label} | heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MiB / ${(mem.heapTotal / 1024 / 1024).toFixed(1)}MiB | rss: ${(mem.rss / 1024 / 1024).toFixed(1)}MiB`);
}

// FORMAT ERROR
function formatError(err: unknown): string {
    /**
     * Extracts a readable error message from API errors.
     * Handles JSON error responses (e.g. Gemini 429) and regular Error objects.
     */

    const raw = err instanceof Error ? err.message : String(err);
    try {
        const parsed = JSON.parse(raw) as {error?: {message?: string}; message?: string};
        const msg = parsed?.error?.message ?? parsed?.message;
        if (typeof msg === "string") return msg;
    } catch {
        // not JSON, use raw message
    }
    return raw;
}

// PUSH SUGGESTED CONDITIONS
function pushSuggestedConditions(conditions: ReturnType<typeof and>[]) {
    /**
     * Appends the "suggested" filter conditions to the given array: asking price
     * must be below the AI-estimated buy price midpoint, and the van must have
     * no VAT (either null or explicitly "No VAT").
     */

    conditions.push(isNotNull(prospectListings.aiBuyPriceLow));
    conditions.push(isNotNull(prospectListings.aiBuyPriceHigh));
    conditions.push(
        gt(
            sql`(${prospectListings.aiBuyPriceLow} + ${prospectListings.aiBuyPriceHigh}) / 2`,
            prospectListings.askingPrice
        )
    );
    conditions.push(
        or(
            isNull(prospectListings.vatStatus),
            eq(prospectListings.vatStatus, "No VAT")
        )
    );
}

// BUILD WHERE CONDITIONS
function buildWhereConditions(filters: SearchFilters) {
    /**
     * Converts structured SearchFilters into an array of Drizzle ORM conditions
     * for querying the prospectListings table.
     */

    const conditions = [];

    if (filters.makeAndModel) {
        conditions.push(ilike(prospectListings.makeAndModel, `%${filters.makeAndModel}%`));
    }

    if (filters.maxPrice !== null) {
        conditions.push(lte(prospectListings.askingPrice, filters.maxPrice));
    }

    if (filters.minPrice !== null) {
        conditions.push(gte(prospectListings.askingPrice, filters.minPrice));
    }

    if (filters.maxMileage !== null) {
        conditions.push(lte(prospectListings.mileage, filters.maxMileage));
    }

    if (filters.minMileage !== null) {
        conditions.push(gte(prospectListings.mileage, filters.minMileage));
    }

    if (filters.maxYear !== null) {
        conditions.push(lte(prospectListings.year, filters.maxYear));
    }

    if (filters.minYear !== null) {
        conditions.push(gte(prospectListings.year, filters.minYear));
    }

    if (filters.fuelType) {
        conditions.push(ilike(prospectListings.fuelType, filters.fuelType));
    }

    if (filters.bodyType) {
        conditions.push(ilike(prospectListings.bodyType, `%${filters.bodyType}%`));
    }

    if (filters.gearboxType) {
        conditions.push(ilike(prospectListings.gearboxType, filters.gearboxType));
    }

    if (filters.colour) {
        conditions.push(ilike(prospectListings.colour, `%${filters.colour}%`));
    }

    if (filters.location) {
        conditions.push(ilike(prospectListings.location, `%${filters.location}%`));
    }

    if (filters.campervanConversion) {
        conditions.push(isNotNull(prospectListings.aiCampervanConversion));
    }

    if (filters.suggestedOnly) {
        // restrict to listings where asking price is below the ai-estimated buy price midpoint
        // and the van has no vat (either null or explicitly "No VAT")
        pushSuggestedConditions(conditions);
    }

    // always restrict to listings with status "New" or "Interested"
    conditions.push(
        or(
            eq(prospectListings.status, "New"),
            eq(prospectListings.status, "Interested")
        )
    );

    return conditions;
}

// FORMAT ACTIVE FILTERS
function formatActiveFilters(filters: SearchFilters): string[] {
    /**
     * Returns a list of human-readable strings describing which filters are active.
     * Used to display filter chips below the search input.
     */

    const active: string[] = [];

    if (filters.makeAndModel) active.push(`Make/Model: ${filters.makeAndModel}`);
    if (filters.minPrice !== null) active.push(`Min Price: £${filters.minPrice.toLocaleString()}`);
    if (filters.maxPrice !== null) active.push(`Max Price: £${filters.maxPrice.toLocaleString()}`);
    if (filters.minMileage !== null) active.push(`Min Mileage: ${filters.minMileage.toLocaleString()}`);
    if (filters.maxMileage !== null) active.push(`Max Mileage: ${filters.maxMileage.toLocaleString()}`);
    if (filters.minYear !== null) active.push(`From Year: ${filters.minYear}`);
    if (filters.maxYear !== null) active.push(`To Year: ${filters.maxYear}`);
    if (filters.fuelType) active.push(`Fuel: ${filters.fuelType}`);
    if (filters.bodyType) active.push(`Body: ${filters.bodyType}`);
    if (filters.gearboxType) active.push(`Gearbox: ${filters.gearboxType}`);
    if (filters.colour) active.push(`Colour: ${filters.colour}`);
    if (filters.location) active.push(`Location: ${filters.location}`);
    if (filters.campervanConversion) active.push("Campervan Conversion");
    if (filters.suggestedOnly) active.push("Suggested (price < estimated value)");
    if (filters.freeText) active.push(`Semantic: "${filters.freeText}"`);

    return active;
}

// PAGE
export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{q?: string}>;
}) {
    /**
     * Search page for Auto Ads. Parses natural language queries into SQL filters via Gemini,
     * queries the prospectListings table, then reranks results using a cross-encoder model.
     */

    logMem("Page function entered");
    const pageStartTime = Date.now();

    const resolvedSearchParams = await searchParams;
    const session = await getServerSessionFromCookies();

    if (!session) {
        return (
            <>
                <Typography variant="h3">Search</Typography>
                <Typography>You must be logged in to access this page.</Typography>
            </>
        );
    }

    const userTier = getUserTier(session.user.groups);

    if (!compareTiers(userTier, 'BasicTier')) {
        return (
            <>
                <Typography variant="h3">Search</Typography>
                <Typography>You must have BasicTier or higher to access this page.</Typography>
            </>
        );
    }

    const query = resolvedSearchParams?.q?.trim() || "";
    let listings: InferSelectModel<typeof prospectListings>[] = [];
    let listingImages: Map<number, InferSelectModel<typeof images> | null> = new Map();
    let rerankScores: Map<number, number> = new Map();
    let error: string | null = null;
    let filters: SearchFilters | null = null;
    let activeFilterLabels: string[] = [];
    let sqlCandidateCount = 0;

    if (query) {
        logMem(`Starting search for: "${query.substring(0, 80)}"`);
        try {
            // step 1: parse natural language query into structured filters via gemini
            logMem("Step 1: calling parseSearchQuery (Gemini API)");
            const parseStartTime = Date.now();
            const parseResult = await parseSearchQuery(query);
            const parseDuration = Date.now() - parseStartTime;
            logMem(`Step 1 done: parseSearchQuery took ${parseDuration}ms`);
            filters = parseResult.filters;
            if (parseResult.error) error = parseResult.error;
            activeFilterLabels = formatActiveFilters(filters);

            // step 2: build and execute sql query with structured filters
            logMem("Step 2: executing SQL query");
            const sqlStartTime = Date.now();
            const whereConditions = buildWhereConditions(filters);
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

            const candidates = await getAutoAdsDb()
                .select()
                .from(prospectListings)
                .where(whereClause)
                .orderBy(desc(sql`(${prospectListings.aiBuyPriceLow} + ${prospectListings.aiBuyPriceHigh})::float / ${prospectListings.askingPrice} / CASE WHEN ${prospectListings.vatStatus} = '+VAT' THEN 1.2 ELSE 1.0 END`))
                .limit(SQL_CANDIDATE_LIMIT);

            sqlCandidateCount = candidates.length;
            const sqlDuration = Date.now() - sqlStartTime;
            logMem(`Step 2 done: SQL query returned ${sqlCandidateCount} candidates in ${sqlDuration}ms`);

            // step 3: rerank candidates using cross-encoder for semantic relevance
            // dynamic import defers loading @huggingface/transformers until needed
            if (candidates.length > 0) {
                logMem("Step 3: importing reranker module");
                const importStartTime = Date.now();
                const documents = candidates.map(buildDocumentText);
                const {rerank} = await import("../lib/reranker");
                const importDuration = Date.now() - importStartTime;
                logMem(`Step 3a: reranker imported in ${importDuration}ms, reranking ${documents.length} documents`);

                const rerankStartTime = Date.now();
                const semanticQuery = filters.freeText || query;
                const ranked = await rerank(semanticQuery, documents, TOP_K);
                const rerankDuration = Date.now() - rerankStartTime;
                logMem(`Step 3b done: rerank took ${rerankDuration}ms`);

                // reorder listings by reranker score and store scores for display
                listings = ranked.map((r) => candidates[r.index]);
                for (const r of ranked) {
                    rerankScores.set(candidates[r.index].id, r.score);
                }
            }

            // step 4: query primary images for the final result set
            if (listings.length > 0) {
                logMem("Step 4: querying images");
                const listingIds = listings.map((listing) => listing.id);
                const primaryImages = await getAutoAdsDb()
                    .select()
                    .from(images)
                    .where(
                        and(
                            eq(images.listingTable, "Prospect"),
                            inArray(images.listingId, listingIds),
                            eq(images.isPrimary, true)
                        )
                    );

                for (const listing of listings) {
                    const image = primaryImages.find((img) => img.listingId === listing.id) || null;
                    listingImages.set(listing.id, image);
                }
                logMem("Step 4 done: images loaded");
            }

            const totalDuration = Date.now() - pageStartTime;
            logMem(`Search complete: ${listings.length} results in ${totalDuration}ms total`);
        } catch (err) {
            const totalDuration = Date.now() - pageStartTime;
            logMem(`Search FAILED after ${totalDuration}ms`);
            console.error("[SEARCH] Error:", err instanceof Error ? err.message : String(err));
            console.error("[SEARCH] Stack:", err instanceof Error ? err.stack : "N/A");
            error = formatError(err);
        }
    }

    return (
        <>
            <Box sx={{pb: error ? "120px" : 0}}>
                <Typography variant="h3">Search</Typography>

                <Suspense fallback={<Box sx={{minHeight: 56, mt: 2, mb: 3}} />}>
                    <SearchInput />
                </Suspense>

                {activeFilterLabels.length > 0 && (
                    <Box sx={{display: "flex", flexWrap: "wrap", gap: 0.5, mb: 2}}>
                        {activeFilterLabels.map((label) => (
                            <Chip key={label} label={label} size="small" variant="outlined" />
                        ))}
                    </Box>
                )}

                {query && !error && (
                    <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                        Found {sqlCandidateCount} candidates via SQL filter, showing top {listings.length} after reranking.
                    </Typography>
                )}

                {error && (
                    <Typography color="error" sx={{mt: 2}}>
                        {listings.length > 0
                            ? "Gemini API error; results shown using semantic search only. See error bar below for details."
                            : "Error performing search. See error bar below for details."}
                    </Typography>
                )}

                {!query ? (
                    <Typography color="text.secondary" sx={{mt: 2}}>
                        Enter a search query above to find prospect listings.
                    </Typography>
                ) : query && listings.length === 0 ? (
                    <Typography sx={{mt: 2}}>
                        No results found for &ldquo;{query}&rdquo;. Try a different search.
                    </Typography>
                ) : (
                    <Box sx={{mt: 3}}>
                        {listings.map((listing) => {
                            const image = listingImages.get(listing.id);
                            const score = rerankScores.get(listing.id);
                            return (
                                <Box key={listing.id} sx={{display: "flex", alignItems: "flex-start", gap: 1, mb: 0}}>
                                    {score !== undefined && (
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                mt: 1.5,
                                                minWidth: 44,
                                                textAlign: "right",
                                                color: "text.secondary",
                                                fontFamily: "monospace",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {score.toFixed(2)}
                                        </Typography>
                                    )}
                                    <Box sx={{flex: 1, minWidth: 0}}>
                                        <ProspectCard
                                            listing={listing}
                                            imageUrl={image?.url || null}
                                        />
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </Box>
            <ErrorBar error={error} />
        </>
    );
}
