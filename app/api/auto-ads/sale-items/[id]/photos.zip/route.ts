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
     * Streams every image attached to a sale item as a single ZIP file
     * the user can extract and drag into Facebook Marketplace's photo
     * picker. Photos are ordered the same way as the resales route so
     * after Facebook reverses the upload order the primary image ends
     * up as the cover photo and the rest follow in insertion order.
     * Returns 404 when the sale item has no images so the client can
     * keep the Download photos button disabled.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return NextResponse.json({success: false, error: "Not authenticated"}, {status: 401});
    }

    // parse the sale item id from the dynamic route segment
    const {id: idParam} = await context.params;
    const itemId = Number(idParam);
    if (!Number.isInteger(itemId) || itemId <= 0) {
        return NextResponse.json({success: false, error: "Invalid sale item id"}, {status: 400});
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
                    eq(images.listingTable, "SaleItem"),
                    eq(images.listingId, itemId),
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
                "Content-Disposition": `attachment; filename="sale-item-${itemId}-photos.zip"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("Failed to build sale item photos ZIP:", err);
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({success: false, error: message}, {status: 500});
    }
}
