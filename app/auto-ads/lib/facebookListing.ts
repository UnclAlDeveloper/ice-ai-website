import JSZip from "jszip";

import type {PublishableListing} from "@app/auto-ads/lib/listingForPublish";

// FACEBOOK TITLE MAX LENGTH
const FACEBOOK_TITLE_MAX = 100;
/**
 * Facebook Marketplace caps listing titles at 100 characters; descriptions
 * longer than the title are fine and go in the body.
 */

// FACEBOOK CREATE VEHICLE URL
const FACEBOOK_CREATE_VEHICLE_URL = "https://www.facebook.com/marketplace/create/vehicle";
/** Desktop create-listing URL for a Marketplace vehicle listing. */

// FACEBOOK CREATE ITEM URL
const FACEBOOK_CREATE_ITEM_URL = "https://www.facebook.com/marketplace/create/item";
/** Desktop create-listing URL for a generic Marketplace item listing. */

// FACEBOOK CREATE URL FOR LISTING
function facebookCreateUrl(listing: PublishableListing): string {
    /**
     * Picks the correct Marketplace create-listing URL for the given
     * publishable listing. Vehicle (Resale) listings open the dedicated
     * vehicle wizard; sale items open the generic item wizard since
     * Facebook has no per-category create flow for non-vehicles.
     */

    return listing.listingTable === 'Resale'
        ? FACEBOOK_CREATE_VEHICLE_URL
        : FACEBOOK_CREATE_ITEM_URL;
}


// FACEBOOK LISTING PAYLOAD
export type FacebookListingPayload = {
    marketplaceUrl: string;
    mode: "create" | "edit";
    title: string;
    description: string;
    copyText: string;
};
/**
 * Shape returned by buildFacebookPayload and consumed by the client. The
 * copyText field is the exact value that should be written to the
 * clipboard so the user can paste it into Facebook's description box.
 * Photo URLs are deliberately excluded; the photos ZIP is served by a
 * separate route so the "Create / Update" flow doesn't couple opening
 * Facebook to pulling images from S3.
 */


// TRUNCATE TITLE
function truncateTitle(title: string): string {
    /**
     * Clips the listing title to Facebook Marketplace's 100-character limit
     * and appends an ellipsis when a clip was necessary.
     */

    const trimmed = title.trim();
    if (trimmed.length <= FACEBOOK_TITLE_MAX) return trimmed;
    return trimmed.slice(0, FACEBOOK_TITLE_MAX - 1) + "…";
}


// SPECS TO BULLETS
function specsToBullets(specsAndFeatures: string | null): string[] {
    /**
     * Splits multi-line specs & features text into individual bullet lines,
     * dropping empty entries so the final description stays tidy.
     */

    if (!specsAndFeatures?.trim()) return [];
    return specsAndFeatures
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}


// EXTRACT FACEBOOK ITEM ID
export function extractFacebookItemId(facebookUrl: string | null | undefined): string | null {
    /**
     * Extracts the numeric item id from a stored Facebook Marketplace URL
     * such as https://www.facebook.com/marketplace/item/1234567890123/.
     * Returns null when the URL is missing or does not match the expected
     * shape, which is the signal used to choose create vs edit mode.
     */

    if (!facebookUrl?.trim()) return null;
    const match = facebookUrl.match(/\/marketplace\/item\/(\d+)/i);
    return match?.[1] ?? null;
}


// MARKETPLACE URL FOR MODE
function marketplaceUrlForMode(listing: PublishableListing): {
    url: string;
    mode: "create" | "edit";
} {
    /**
     * Picks the target Marketplace URL based on whether the listing already
     * has a Facebook URL. Edit mode opens the item page so the user can
     * click Facebook's own Edit button from there; create mode opens the
     * appropriate create wizard for the listing's table.
     */

    const itemId = extractFacebookItemId(listing.facebookUrl);
    if (itemId) {
        return {
            url: `https://www.facebook.com/marketplace/item/${itemId}/`,
            mode: "edit",
        };
    }
    return {url: facebookCreateUrl(listing), mode: "create"};
}


// BUILD DESCRIPTION BODY
function buildDescriptionBody(listing: PublishableListing): string {
    /**
     * Composes the description body pasted into Facebook: the main
     * description first, an optional MOT expiry line for vehicles, and
     * finally a bullet list of any specs & features. Other vehicle facts
     * (year, mileage, price, etc.) are entered into Facebook's own
     * structured fields so they deliberately do not appear in the prose.
     * Sale items only contribute the body text plus the optional Features
     * block since they have no specsAndFeatures and no vehicle aspects.
     */

    const parts: string[] = [];

    // description block: main body with mot appended on its own line for vehicles
    const descriptionLines: string[] = [];
    const mainBody = listing.body?.trim() || listing.title?.trim();
    if (mainBody) descriptionLines.push(mainBody);
    const motExpiry = listing.vehicle?.motExpiry?.trim();
    if (motExpiry) {
        descriptionLines.push(`MOT expires: ${motExpiry}`);
    }
    if (descriptionLines.length > 0) parts.push(descriptionLines.join("\n"));

    // specs & features list, one bullet per line
    const bullets = specsToBullets(listing.specsAndFeatures);
    if (bullets.length > 0) {
        parts.push(`Features:\n${bullets.map((b) => `• ${b}`).join("\n")}`);
    }

    return parts.join("\n\n");
}


// BUILD FACEBOOK PAYLOAD
export function buildFacebookPayload(listing: PublishableListing): FacebookListingPayload {
    /**
     * Produces the clipboard text, title, and target Marketplace URL for a
     * publishable listing. Pure: no database or image access, so it can be
     * unit tested against a fixture row without any setup. The copyText
     * includes the title on its own line followed by a blank line and the
     * body so users can either paste the whole lot into the description
     * field or split the first line into the title field.
     */

    const title = truncateTitle(listing.title || "");
    const description = buildDescriptionBody(listing);
    const {url: marketplaceUrl, mode} = marketplaceUrlForMode(listing);

    const copyText = description ? `${title}\n\n${description}` : title;

    return {
        marketplaceUrl,
        mode,
        title,
        description,
        copyText,
    };
}


// FETCH IMAGE AS BUFFER
async function fetchImageAsBuffer(url: string): Promise<{name: string; data: ArrayBuffer}> {
    /**
     * Fetches a single image URL and returns its bytes along with a file
     * name derived from the URL's path component. Throws when the fetch
     * fails so the caller can surface a meaningful error instead of
     * producing a silently-empty ZIP entry.
     */

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image (${response.status}): ${url}`);
    }
    const data = await response.arrayBuffer();

    // derive a reasonable filename from the URL path, falling back to a
    // numeric placeholder when the URL does not contain one
    let name = "photo";
    try {
        const pathname = new URL(url).pathname;
        const last = pathname.split("/").filter(Boolean).pop();
        if (last) name = decodeURIComponent(last);
    } catch {
        // URL was unparseable - keep the placeholder name
    }
    return {name, data};
}


// CREATE PHOTOS ZIP
export async function createPhotosZip(photoUrls: string[]): Promise<Buffer> {
    /**
     * Fetches every provided S3 photo URL server-side and streams the
     * bytes into a single in-memory ZIP. Doing the fetches server-side
     * avoids CORS issues and keeps the client interaction to a single
     * download. Entries are named with a 1-based sequence prefix so they
     * sort and upload in the order supplied by the caller; ordering
     * decisions (including any Facebook-reversal compensation) therefore
     * live with the caller rather than this helper.
     */

    if (photoUrls.length === 0) {
        throw new Error("No photo URLs supplied to createPhotosZip.");
    }

    const zip = new JSZip();
    const used = new Set<string>();

    // fetch all images in parallel to keep the overall latency low
    const fetched = await Promise.all(photoUrls.map((url) => fetchImageAsBuffer(url)));

    fetched.forEach((entry, index) => {
        const seq = String(index + 1).padStart(2, "0");
        let name = `${seq}_${entry.name}`;
        if (used.has(name)) {
            name = `${seq}_${index}_${entry.name}`;
        }
        used.add(name);
        zip.file(name, entry.data);
    });

    return zip.generateAsync({type: "nodebuffer", compression: "STORE"});
}
