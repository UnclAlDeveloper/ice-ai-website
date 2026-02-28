// BUILD DOCUMENT TEXT
export function buildDocumentText(listing: {
    makeAndModel: string;
    shortDescription: string;
    fullDescription?: string | null;
    location?: string | null;
    bodyType?: string | null;
    fuelType?: string | null;
    askingPrice?: number | null;
    year?: number | null;
    mileage?: number | null;
    colour?: string | null;
    specsAndFeatures?: string | null;
    aiResellOverview?: string | null;
    aiResellNotes?: string | null;
    aiWorkAndRepairs?: string | null;
}): string {
    /**
     * Assembles a text representation of a listing for the reranker.
     * Combines key structured fields, descriptions, specs, and AI analysis
     * into a single string that captures the listing's full characteristics.
     */

    const parts: string[] = [];

    parts.push(`${listing.makeAndModel} - ${listing.shortDescription}`);

    if (listing.year) parts.push(`Year: ${listing.year}`);
    if (listing.mileage) parts.push(`Mileage: ${listing.mileage.toLocaleString()} miles`);
    if (listing.askingPrice != null) parts.push(`Price: £${listing.askingPrice.toLocaleString()}`);
    if (listing.location) parts.push(`Location: ${listing.location}`);
    if (listing.bodyType) parts.push(`Body: ${listing.bodyType}`);
    if (listing.fuelType) parts.push(`Fuel: ${listing.fuelType}`);
    if (listing.colour) parts.push(`Colour: ${listing.colour}`);

    // include full text fields for richer semantic reranking context
    if (listing.aiResellOverview) {
        parts.push(listing.aiResellOverview);
    }

    if (listing.aiResellNotes) {
        parts.push(listing.aiResellNotes);
    }

    if (listing.aiWorkAndRepairs) {
        parts.push(listing.aiWorkAndRepairs);
    }

    if (listing.fullDescription) {
        parts.push(listing.fullDescription);
    }

    if (listing.specsAndFeatures) {
        parts.push(listing.specsAndFeatures);
    }

    return parts.join(". ");
}
