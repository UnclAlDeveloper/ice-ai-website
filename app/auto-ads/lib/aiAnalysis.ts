import {GoogleGenAI} from "@google/genai";
import {readFileSync} from "fs";
import {join} from "path";
import {and, asc, eq} from "drizzle-orm";
import {getAutoAdsDb} from "@app/lib/autoAdsDb";
import {prospectListings, images} from "@/drizzle/auto-ads/schema";

// PROSPECT LISTING ROW
type ProspectListingRow = typeof prospectListings.$inferSelect;
/**
 * Drizzle-inferred row type for the prospect_listings table. Used as the
 * input shape for the AI analysis helpers below so call sites can pass a
 * full row straight from a select query.
 */

// AI ANALYSIS FIELDS
export interface AiAnalysisFields {
    /**
     * Subset of prospect_listings columns that the AI analysis writes back.
     * Mirrors the fields populated by apply_ai_analysis in the Python module.
     */

    aiResellOverview: string | null;
    aiWorkAndRepairs: string | null;
    aiResellNotes: string | null;
    aiValueAddImprovements: string | null;
    aiCampervanConversion: string | null;
    aiTargetMarket: string | null;
    aiBuyPriceLow: number | null;
    aiBuyPriceHigh: number | null;
    aiRepairCost: number | null;
    aiSellPriceLow: number | null;
    aiSellPriceHigh: number | null;
}

// GEMINI INLINE IMAGE PART
type InlineImagePart = {inlineData: {data: string; mimeType: string}};

// FORMAT VALUE
function formatValue(value: unknown, fallback = "N/A"): string {
    /**
     * Converts an optional value into its string form, returning the supplied
     * fallback when the value is null, undefined, or an empty string.
     */

    if (value === null || value === undefined || value === "") {
        return fallback;
    }
    return String(value);
}

// CONVERT PROSPECT LISTING TO MARKDOWN
export function convertProspectListingToMarkdown(listing: ProspectListingRow): string {
    /**
     * Builds the markdown summary of a prospect listing that gets appended to
     * the Gemini prompt. The layout matches convert_prospect_listing_to_markdown
     * in ai_analysis.py so the LLM sees identical structure across stacks.
     */

    const parts: string[] = [];

    // header with make and model
    parts.push(`# ${formatValue(listing.makeAndModel, "Unknown")}`);

    // short description
    parts.push(`## ${formatValue(listing.shortDescription, "No description")}`);
    parts.push("");

    // overview section
    parts.push("## Overview");

    // mileage with unit
    let mileageStr = formatValue(listing.mileage);
    if (listing.mileageUnit) {
        mileageStr += ` ${listing.mileageUnit}`;
    }
    parts.push(`- Mileage: ${mileageStr}`);

    parts.push(`- Year: ${formatValue(listing.year)}`);
    parts.push(`- Registration: ${formatValue(listing.registration)}`);
    parts.push(`- Body type: ${formatValue(listing.bodyType)}`);
    parts.push(`- Cab type: ${formatValue(listing.cabType)}`);
    parts.push(`- Wheelbase: ${formatValue(listing.wheelbase)}`);
    parts.push(`- Engine: ${formatValue(listing.engineSize)}`);
    parts.push(`- Emission class: ${formatValue(listing.emissionClass)}`);
    parts.push(`- Gearbox: ${formatValue(listing.gearboxType)}`);
    parts.push(`- Fuel type: ${formatValue(listing.fuelType)}`);
    parts.push(`- Seats: ${formatValue(listing.seats)}`);
    parts.push(`- Colour: ${formatValue(listing.colour)}`);
    parts.push("");

    // specs and features section
    if (listing.specsAndFeatures) {
        parts.push(listing.specsAndFeatures);
        parts.push("");
    }

    // description section
    parts.push("## Description");
    parts.push(formatValue(listing.fullDescription, "No description available"));
    parts.push("");

    // history section
    parts.push("## History");
    parts.push(`- Owners: ${formatValue(listing.numberOfOwners)}`);

    // service history subsection
    parts.push("### Service history:");
    parts.push(formatValue(listing.serviceHistory, "Not available"));
    parts.push("");

    // basic checks subsection
    parts.push("### Basic checks (out of 5)");
    parts.push(formatValue(listing.basicHistoryCheck, "Not available"));
    parts.push("");

    // mot status subsection
    parts.push("### MOT status");
    parts.push(formatValue(listing.motStatus, "Not available"));

    return parts.join("\n");
}

// READ PROMPT FILE
function readPromptFile(filename: string): string {
    /**
     * Reads a Gemini prompt template from the app directory at call time so
     * prompt edits take effect without restarting the server. Prompt files
     * for vans and cars are symlinked into app/ from the python folder.
     */

    const promptPath = join(process.cwd(), "app", filename);
    return readFileSync(promptPath, "utf-8");
}

// FORMAT TODAY
function formatToday(): string {
    /**
     * Returns the current date in YYYY-MM-DD form to substitute into the
     * {date} placeholder used by the prompt templates.
     */

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// FETCH IMAGE AS INLINE PART
async function fetchImageAsPart(url: string): Promise<InlineImagePart | null> {
    /**
     * Downloads an image from a URL and converts it to a base64 inline data
     * part for the Gemini API. Infers the MIME type from the URL extension
     * when the response carries a generic content-type header.
     */

    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const arrayBuffer = await response.arrayBuffer();
        const data = Buffer.from(arrayBuffer).toString("base64");

        // infer mime type from url extension when s3 returns octet-stream
        let mimeType = response.headers.get("content-type") || "";
        if (!mimeType || mimeType === "application/octet-stream" || mimeType === "binary/octet-stream") {
            const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
            const mimeMap: Record<string, string> = {
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                png: "image/png",
                webp: "image/webp",
            };
            mimeType = (ext && mimeMap[ext]) || "image/jpeg";
        }

        return {inlineData: {data, mimeType}};
    } catch {
        return null;
    }
}

// GENERATE AI ANALYSIS
export async function generateAiAnalysis(
    promptFilename: string,
    listing: ProspectListingRow,
    imageUrls: string[] = [],
): Promise<string | null> {
    /**
     * Builds the full prompt by combining the prompt template with the
     * markdown summary of the listing, then calls Gemini with any supplied
     * image URLs alongside the text. Returns the raw markdown response or
     * null if the API key, model name, or response is missing.
     */

    const apiKey = process.env.AUTO_ADS_GOOGLE_API_KEY;
    const modelName = process.env.GEMINI_MODEL_NAME;

    if (!apiKey) {
        console.error("[AI ANALYSIS] AUTO_ADS_GOOGLE_API_KEY is not set");
        return null;
    }
    if (!modelName) {
        console.error("[AI ANALYSIS] GEMINI_MODEL_NAME is not set");
        return null;
    }

    // load prompt template and substitute today's date
    const promptTemplate = readPromptFile(promptFilename);
    const prompt = promptTemplate.replace("{date}", formatToday());

    // append the listing markdown to the prompt
    const listingMarkdown = convertProspectListingToMarkdown(listing);
    const fullPrompt = `${prompt}\n\n${listingMarkdown}`;

    // fetch all images in parallel, skip any that fail to download
    const imageParts = (await Promise.all(imageUrls.map(fetchImageAsPart)))
        .filter((p): p is InlineImagePart => p !== null);

    const userParts: object[] = [{text: fullPrompt}, ...imageParts];

    const ai = new GoogleGenAI({apiKey});

    try {
        console.log(`[AI ANALYSIS] Calling Gemini API: model=${modelName}, images=${imageParts.length}`);
        const startTime = Date.now();

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{role: "user", parts: userParts}],
        });

        const duration = Date.now() - startTime;
        const text = response.text?.trim() || "";
        console.log(`[AI ANALYSIS] Gemini responded in ${duration}ms (${text.length} chars)`);

        if (!text) return null;
        return text;
    } catch (err) {
        console.error("[AI ANALYSIS] Gemini API error:", err instanceof Error ? err.message : String(err));
        return null;
    }
}

// PARSE PRICE
function parsePrice(priceStr: string | null | undefined): number | null {
    /**
     * Extracts an integer pound amount from a string such as "£27,500", or
     * returns null when the value is missing or not numeric after cleaning.
     */

    if (!priceStr) return null;

    const cleaned = priceStr.replace(/[£,\s]/g, "");
    const value = parseInt(cleaned, 10);
    return Number.isNaN(value) ? null : value;
}

// EXTRACT SECTION
function extractSection(content: string, header: string): string | null {
    /**
     * Returns the trimmed body of the markdown section whose H1 heading
     * matches the supplied header (case-insensitive), or null when the
     * section is absent. Captures everything until the next H1 heading.
     */

    const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
        `^\\s*#\\s*${escapedHeader}\\s*\\n([\\s\\S]*?)(?=^\\s*#\\s|$(?![\\s\\S]))`,
        "im",
    );
    const match = content.match(pattern);
    return match ? match[1].trim() : null;
}

// MATCH PRICE LINE
function matchPriceLine(section: string, label: string): number | null {
    /**
     * Searches a price-ranges section for a labelled value such as
     * "Low buy price: £12,345" and returns the parsed integer, or null
     * when the label is absent. Tolerates surrounding markdown bold markers.
     */

    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\*{0,2}${escapedLabel}:?\\*{0,2}:?\\s*(£[\\d,]+)`, "i");
    const match = section.match(regex);
    return match ? parsePrice(match[1]) : null;
}

// PARSE AI ANALYSIS
export function parseAiAnalysis(rawAnalysis: string): AiAnalysisFields {
    /**
     * Parses the markdown returned by Gemini into the structured fields the
     * prospect_listings table stores. Mirrors apply_ai_analysis from the
     * Python module but returns a plain object instead of mutating a row
     * so callers can decide how to persist the result.
     */

    // strip any surrounding markdown code fence
    let analysis = rawAnalysis.trim();
    if (analysis.startsWith("```markdown")) {
        analysis = analysis.slice("```markdown".length).trim();
    } else if (analysis.startsWith("```")) {
        analysis = analysis.slice(3).trim();
    }
    if (analysis.endsWith("```")) {
        analysis = analysis.slice(0, -3).trim();
    }

    // extract narrative sections
    const overview = extractSection(analysis, "Overview");
    const repairCosts = extractSection(analysis, "Repair costs");
    const notes = extractSection(analysis, "Notes");
    const valueAdd = extractSection(analysis, "Value added improvements");
    const campervanConversion = extractSection(analysis, "Campervan Conversion");
    const market = extractSection(analysis, "Market");

    // extract price ranges section and pull each labelled value
    const priceSection = extractSection(analysis, "Price ranges");
    const aiBuyPriceLow = priceSection ? matchPriceLine(priceSection, "Low buy price") : null;
    const aiBuyPriceHigh = priceSection ? matchPriceLine(priceSection, "High buy price") : null;
    const aiRepairCost = priceSection ? matchPriceLine(priceSection, "Expected repair cost") : null;
    const aiSellPriceLow = priceSection ? matchPriceLine(priceSection, "Low sell price") : null;
    const aiSellPriceHigh = priceSection ? matchPriceLine(priceSection, "High sell price") : null;

    return {
        aiResellOverview: overview || null,
        aiWorkAndRepairs: repairCosts || null,
        aiResellNotes: notes || null,
        aiValueAddImprovements: valueAdd || null,
        aiCampervanConversion: campervanConversion || null,
        aiTargetMarket: market || null,
        aiBuyPriceLow,
        aiBuyPriceHigh,
        aiRepairCost,
        aiSellPriceLow,
        aiSellPriceHigh,
    };
}

// APPLY AI ANALYSIS
export async function applyAiAnalysis(
    listingId: number,
    rawAnalysis: string,
): Promise<AiAnalysisFields> {
    /**
     * Parses the AI analysis and writes the resulting fields back to the
     * matching prospect_listings row. Returns the parsed fields so the
     * caller can also use them in memory.
     */

    const fields = parseAiAnalysis(rawAnalysis);

    await getAutoAdsDb()
        .update(prospectListings)
        .set({
            ...fields,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(prospectListings.id, listingId));

    return fields;
}

// FETCH PROSPECT IMAGE URLS
async function fetchProspectImageUrls(listingId: number): Promise<string[]> {
    /**
     * Loads every image URL attached to a prospect listing in deterministic
     * order, so the Gemini call sees the same images regardless of insertion
     * timing variation between rows.
     */

    const rows = await getAutoAdsDb()
        .select({url: images.url})
        .from(images)
        .where(
            and(
                eq(images.listingTable, "Prospect"),
                eq(images.listingId, listingId),
            ),
        )
        .orderBy(asc(images.id));

    return rows.map((r) => r.url);
}

// PROCESS AI ANALYSIS RESULT
export interface ProcessAiAnalysisResult {
    /**
     * Outcome of running the full AI analysis workflow for a single listing.
     */

    success: boolean;
    fields?: AiAnalysisFields;
    error?: string;
}

// PROCESS AI ANALYSIS FOR LISTING
export async function processAiAnalysisForListing(
    promptFilename: string,
    listing: ProspectListingRow,
    imageUrlsOverride?: string[],
): Promise<ProcessAiAnalysisResult> {
    /**
     * Runs the full workflow for a single listing: fetches its images
     * (unless an override is supplied), generates the AI analysis, parses
     * it, and persists the resulting fields. Returns a result wrapper so
     * callers can branch on success without dealing with throws.
     */

    try {
        // resolve which image urls to send to Gemini
        const imageUrls = imageUrlsOverride ?? (await fetchProspectImageUrls(listing.id));

        // generate raw markdown from Gemini
        const rawAnalysis = await generateAiAnalysis(promptFilename, listing, imageUrls);
        if (!rawAnalysis) {
            return {success: false, error: "Empty AI analysis response"};
        }

        // parse and persist
        const fields = await applyAiAnalysis(listing.id, rawAnalysis);
        return {success: true, fields};
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[AI ANALYSIS] Failed for listing ${listing.id}:`, message);
        return {success: false, error: message};
    }
}

// REGENERATE ALL AI ANALYSES
export async function regenerateAllAiAnalyses(
    promptFilename: string,
    listingSource: typeof prospectListings.$inferSelect.listingSource,
    skipRows = 0,
): Promise<{processed: number; failed: number}> {
    /**
     * Iterates through every prospect listing for a given source and
     * regenerates the AI analysis for each one, ordered by id with the
     * first skipRows rows skipped. Mirrors regenerate_all_ai_analyses
     * from the Python module so the same prompt can be re-run in bulk.
     */

    const db = getAutoAdsDb();

    // load listings ordered by id so skipRows is deterministic
    const allListings = await db
        .select()
        .from(prospectListings)
        .where(eq(prospectListings.listingSource, listingSource))
        .orderBy(asc(prospectListings.id));

    const targetListings = allListings.slice(skipRows);
    const totalCount = targetListings.length;
    console.log(`[AI ANALYSIS] Found ${totalCount} prospect listings to process`);

    let processed = 0;
    let failed = 0;

    for (let index = 0; index < targetListings.length; index++) {
        const listing = targetListings[index];
        console.log(
            `[AI ANALYSIS] Processing ${index + 1}/${totalCount}: ${listing.makeAndModel} (ID: ${listing.id})`,
        );

        const result = await processAiAnalysisForListing(promptFilename, listing);
        if (result.success) {
            processed += 1;
            console.log(`[AI ANALYSIS]   Successfully updated listing ${listing.id}`);
        } else {
            failed += 1;
            console.error(`[AI ANALYSIS]   Error processing listing ${listing.id}: ${result.error}`);
        }
    }

    console.log(`[AI ANALYSIS] Finished processing ${totalCount} prospect listings (${failed} failed)`);
    return {processed, failed};
}
