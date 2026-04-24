import {NextRequest, NextResponse} from "next/server";
import {and, asc, eq} from "drizzle-orm";

import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {images} from "@/drizzle/auto-ads/schema";
import {getServerSessionFromCookies} from "@app/lib/session";
import {createPhotosZip} from "@app/auto-ads/lib/facebookListing";

// GET
export async function GET(
    _request: NextRequest,
    context: {params: Promise<{id: string}>},
): Promise<NextResponse> {
    /**
     * Streams every image attached to a resale listing as a single ZIP
     * file the user can extract and drag into Facebook Marketplace's
     * photo picker. Images are ordered primary-first, then by insertion
     * order, matching how they are displayed in the editor. Returns 404
     * when the listing has no images so the client can render the
     * Download photos button in a disabled state.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return NextResponse.json({success: false, error: "Not authenticated"}, {status: 401});
    }

    // parse the listing id from the dynamic route segment
    const {id: idParam} = await context.params;
    const listingId = Number(idParam);
    if (!Number.isInteger(listingId) || listingId <= 0) {
        return NextResponse.json({success: false, error: "Invalid listing id"}, {status: 400});
    }

    try {
        // fetch image rows with primary first, then insertion order
        const rows = await getAutoAdsDb()
            .select({
                id: images.id,
                url: images.url,
                isPrimary: images.isPrimary,
            })
            .from(images)
            .where(
                and(
                    eq(images.listingTable, "Resale"),
                    eq(images.listingId, listingId),
                ),
            )
            .orderBy(asc(images.id));

        if (rows.length === 0) {
            return NextResponse.json({success: false, error: "No photos to download"}, {status: 404});
        }

        // facebook reverses the photo order when images are uploaded in one
        // batch, so we ship the ZIP in reverse: rest in reverse-id order
        // first, with the primary image last. after facebook's reversal the
        // primary lands as the cover photo and the others follow in id order
        const primary = rows.filter((r) => r.isPrimary === true);
        const rest = rows.filter((r) => r.isPrimary !== true);
        const orderedUrls = [...rest.reverse(), ...primary].map((r) => r.url);

        const zipBuffer = await createPhotosZip(orderedUrls);

        return new NextResponse(new Uint8Array(zipBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="resale-${listingId}-photos.zip"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("Failed to build resale photos ZIP:", err);
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({success: false, error: message}, {status: 500});
    }
}
