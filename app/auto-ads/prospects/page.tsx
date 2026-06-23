import React, {Suspense} from "react";
import {getServerSessionFromCookies} from "@app/lib/session";
import {Typography, Box} from "@mui/material";
import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {prospectListings, images} from "@/drizzle/auto-ads/schema";
import {inArray, InferSelectModel, sql, desc, asc, eq, and, isNotNull, gt, or, isNull} from "drizzle-orm";
import ErrorBar from "@components/ErrorBar";
import ProspectCard from "../components/ProspectCard";
import FilterDropdown from "./FilterDropdown";
import SortDropdown from "./SortDropdown";
import ProspectsPagination from "./ProspectsPagination";
import {getUserTier, compareTiers} from "@app/lib/menuUtils";

// PAGE
const PAGE_SIZE = 10;

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ filter?: string; sort?: string; page?: string }>;
}) {
    /* Prospects page for Auto Ads application. Requires authentication, app group membership, and BasicTier or higher. */

    const resolvedSearchParams = await searchParams;
    const session = await getServerSessionFromCookies();

    if (!session) {
        return (
            <>
                <Typography variant="h3">Prospects</Typography>
                <Typography>You must be logged in to access this page.</Typography>
            </>
        );
    }

    const userTier = getUserTier(session.user.groups);

    if (!compareTiers(userTier, 'BasicTier')) {
        return (
            <>
                <Typography variant="h3">Prospects</Typography>
                <Typography>You must have BasicTier or higher to access this page.</Typography>
            </>
        );
    }

    let listings: InferSelectModel<typeof prospectListings>[] = [];
    let listingImages: Map<number, InferSelectModel<typeof images> | null> = new Map();
    let totalCount = 0;
    let page = 1;
    let error: string | null = null;

    const connectionString = process.env.AUTO_ADS_DATABASE_URL;
    const maskedConnectionString = connectionString 
        ? connectionString.replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1****$3')
        : 'Not set';

    try {
        // test database connection first
        await getAutoAdsDb().select().from(prospectListings).limit(0);
    } catch (connErr) {
        error = 'Database connection failed:\n';
        error += connErr instanceof Error ? connErr.message : String(connErr);
        error += '\n\nConnection string: ' + maskedConnectionString;
    }

    if (!error) {
        try {
            const filter = resolvedSearchParams?.filter || 'suggested';
            const sort = resolvedSearchParams?.sort || 'suggested';
            const pageParam = resolvedSearchParams?.page;
            page = Math.max(1, parseInt(String(pageParam), 10) || 1);

            let whereConditions;

            if (filter === 'stock') {
                // stock filter: listings that have been bought
                whereConditions = [
                    eq(prospectListings.status, 'Bought'),
                ];
            } else if (filter === 'classic-cars') {
                // classic cars filter: Classic listing type with active statuses and required AI pricing/notes
                whereConditions = [
                    eq(prospectListings.listingType, 'Classic'),
                    inArray(prospectListings.status, ['New', 'Viewed']),
                    isNotNull(prospectListings.aiSellPriceLow),
                    isNotNull(prospectListings.aiResellNotes),
                ];
            } else {
                const baseConditions = [
                    inArray(prospectListings.status, ['New', 'Viewed']),
                    or(eq(prospectListings.vatStatus, 'No VAT'), isNull(prospectListings.vatStatus)),
                    gt(prospectListings.askingPrice, 0),
                ];

                whereConditions =
                    filter === 'all'
                        ? baseConditions
                        : [
                              ...baseConditions,
                              isNotNull(prospectListings.aiBuyPriceLow),
                              isNotNull(prospectListings.aiBuyPriceHigh),
                              gt(
                                  sql`(${prospectListings.aiBuyPriceLow} + ${prospectListings.aiBuyPriceHigh}) / 2`,
                                  prospectListings.askingPrice
                              ),
                          ];

                if (filter === 'campervan-conversions') {
                    whereConditions.push(isNotNull(prospectListings.aiCampervanConversion));
                }
            }

            const whereClause = and(...whereConditions);

            const [{ count: countResult }] = await getAutoAdsDb()
                .select({ count: sql<number>`count(*)::int` })
                .from(prospectListings)
                .where(whereClause);

            totalCount = countResult ?? 0;

            // build sort order, accounting for filter-specific suggested formulas
            const orderByClause =
                sort === 'latest'
                    ? [desc(prospectListings.updatedAt)]
                    : sort === 'alphabetical'
                      ? [asc(sql`${prospectListings.makeAndModel} || ${prospectListings.shortDescription}`)]
                      : filter === 'stock'
                        ? [desc(prospectListings.updatedAt)]
                        : filter === 'classic-cars'
                          ? [
                                desc(
                                    sql`(${prospectListings.aiSellPriceLow} + ${prospectListings.aiSellPriceHigh}) / 2 * 0.9 - ${prospectListings.aiRepairCost} - ${prospectListings.askingPrice}`
                                ),
                            ]
                          : [
                                desc(
                                    sql`(${prospectListings.aiBuyPriceLow} + ${prospectListings.aiBuyPriceHigh})::float / ${prospectListings.askingPrice}`
                                ),
                            ];

            listings = await getAutoAdsDb()
                .select()
                .from(prospectListings)
                .where(whereClause)
                .orderBy(...orderByClause)
                .limit(PAGE_SIZE)
                .offset((page - 1) * PAGE_SIZE);

            // query primary images for each listing
            if (listings.length > 0) {
                const listingIds = listings.map(listing => listing.id);
                const primaryImages = await getAutoAdsDb()
                    .select()
                    .from(images)
                    .where(
                        and(
                            eq(images.listingTable, 'Prospect'),
                            inArray(images.listingId, listingIds),
                            eq(images.isPrimary, true)
                        )
                    );

                // create a map of listingId -> image
                for (const listing of listings) {
                    const image = primaryImages.find(img => img.listingId === listing.id) || null;
                    listingImages.set(listing.id, image);
                }
            }
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            error += '\n\nConnection string: ' + maskedConnectionString;
        }
    }

    return (
        <>
            <Box sx={{ pb: error ? '120px' : 0 }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 1,
                        mb: 2,
                    }}
                >
                    <Typography variant="h3">Prospects</Typography>
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: 1,
                            minWidth: { sm: 420 },
                            justifyContent: 'flex-end',
                        }}
                    >
                        <Suspense fallback={<Box sx={{ minWidth: 200 }} />}>
                            <FilterDropdown />
                        </Suspense>
                        <Suspense fallback={<Box sx={{ minWidth: 200 }} />}>
                            <SortDropdown />
                        </Suspense>
                    </Box>
                </Box>

                {error ? (
                    <Typography color="error" sx={{ mt: 2 }}>
                        Error loading prospects. See error bar below for details.
                    </Typography>
                ) : listings.length === 0 ? (
                    <Typography>
                        {resolvedSearchParams?.filter === 'stock'
                            ? 'No stock found with status "Bought".'
                            : resolvedSearchParams?.filter === 'classic-cars'
                              ? 'No classic car prospects found with status "New" or "Viewed".'
                              : resolvedSearchParams?.filter === 'campervan-conversions'
                                ? 'No prospects found with status "New" or "Viewed" that have campervan conversion information.'
                                : resolvedSearchParams?.filter === 'all'
                                  ? 'No prospects found with status "New" or "Viewed".'
                                  : 'No suggested prospects found with status "New" or "Viewed".'}
                    </Typography>
                ) : (
                    <>
                        <Box sx={{ mt: 3 }}>
                            {listings.map((listing) => {
                                const image = listingImages.get(listing.id);
                                return (
                                    <ProspectCard
                                        key={listing.id}
                                        listing={listing}
                                        imageUrl={image?.url || null}
                                        showCopyToResale={resolvedSearchParams?.filter === 'stock'}
                                    />
                                );
                            })}
                        </Box>
                        <Suspense fallback={null}>
                            <ProspectsPagination
                                totalCount={totalCount}
                                currentPage={page}
                                pageSize={PAGE_SIZE}
                            />
                        </Suspense>
                    </>
                )}
            </Box>
            <ErrorBar error={error} />
        </>
    );
}
