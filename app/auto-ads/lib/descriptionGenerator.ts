import {GoogleGenAI} from "@google/genai";
import {readFileSync} from "fs";
import {join} from "path";

// VEHICLE DETAILS
export interface VehicleDetails {
    /** Subset of resale listing fields used to build the description prompt. */

    makeAndModel: string;
    shortDescription: string | null;
    year: number | null;
    registration: string | null;
    colour: string | null;
    bodyType: string | null;
    cabType: string | null;
    fuelType: string | null;
    gearboxType: string | null;
    engineSize: string | null;
    seats: number | null;
    mileage: number | null;
    mileageUnit: string | null;
    numberOfOwners: number | null;
    serviceHistory: string | null;
    basicHistoryCheck: string | null;
    motStatus: string | null;
    motExpiry: string | null;
    taxStatus: string | null;
    emissionClass: string | null;
    location: string | null;
    specsAndFeatures: string | null;
}

// READ PROMPT FILE
function readPromptFile(filename: string): string {
    /**
     * Reads a Gemini system prompt from a markdown file stored alongside this
     * module. The file is read at call time so prompt changes take effect
     * without restarting the server.
     */

    const promptPath = join(process.cwd(), "app/auto-ads/lib", filename);
    return readFileSync(promptPath, "utf-8");
}

// BUILD DETAILS TEXT
function buildDetailsText(details: VehicleDetails): string {
    /**
     * Converts the structured vehicle details object into a human-readable
     * text block that is appended to the Gemini user message. Only fields
     * with non-null/non-empty values are included so the model is not
     * confused by blank placeholders.
     */

    const lines: string[] = [];

    // helper to add a line only when the value is present
    const add = (label: string, value: string | number | null | undefined) => {
        if (value !== null && value !== undefined && value !== "") {
            lines.push(`${label}: ${value}`);
        }
    };

    add("Make & Model", details.makeAndModel);
    add("Short Description", details.shortDescription);
    add("Year", details.year);
    add("Registration", details.registration);
    add("Colour", details.colour);
    add("Body Type", details.bodyType);
    add("Cab Type", details.cabType);
    add("Fuel Type", details.fuelType);
    add("Gearbox", details.gearboxType);
    add("Engine Size", details.engineSize);
    add("Seats", details.seats);
    add("Mileage", details.mileage !== null && details.mileage !== undefined
        ? `${details.mileage}${details.mileageUnit ? " " + details.mileageUnit : ""}`
        : null);
    add("Number of Owners", details.numberOfOwners);
    add("Service History", details.serviceHistory);
    add("Basic History Check", details.basicHistoryCheck);
    add("MOT Status", details.motStatus);
    add("MOT Expiry", details.motExpiry);
    add("Tax Status", details.taxStatus);
    add("Emission Class", details.emissionClass);
    add("Location", details.location);
    add("Specs & Features", details.specsAndFeatures);

    return lines.join("\n");
}

// FETCH IMAGE AS INLINE PART
async function fetchImageAsPart(
    url: string,
): Promise<{inlineData: {data: string; mimeType: string}} | null> {
    /**
     * Downloads an image from a URL and converts it to a base64 inline data
     * part for the Gemini API. Infers the MIME type from the URL extension
     * when S3 returns a generic content-type header.
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
                jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
                gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
            };
            mimeType = (ext && mimeMap[ext]) || "image/jpeg";
        }

        return {inlineData: {data, mimeType}};
    } catch {
        return null;
    }
}

// DESCRIPTION RESULT
export interface DescriptionResult {
    /** Structured output from the description generator containing both the prose description and a specs & features list. */

    description: string;
    specsAndFeatures: string | null;
}

// SPLIT DESCRIPTION RESPONSE
function splitDescriptionResponse(raw: string): DescriptionResult {
    /**
     * Splits the Gemini response at the ---SPECS_AND_FEATURES--- delimiter
     * into a description and a specs & features section. If the delimiter is
     * absent the entire response is treated as the description.
     */

    const delimiter = "---SPECS_AND_FEATURES---";
    const idx = raw.indexOf(delimiter);

    if (idx === -1) {
        return {description: raw.trim(), specsAndFeatures: null};
    }

    const description = raw.slice(0, idx).trim();
    const specs = raw.slice(idx + delimiter.length).trim();
    return {
        description,
        specsAndFeatures: specs && specs.toLowerCase() !== "none" ? specs : null,
    };
}

// GENERATE DESCRIPTION
export async function generateDescription(
    details: VehicleDetails,
    imageUrls: string[],
): Promise<DescriptionResult | null> {
    /**
     * Calls the Gemini API with the vehicle details and any available images
     * to generate a compelling listing description and a specs & features
     * list. The system prompt is read from create_description.md at call
     * time. Returns a DescriptionResult with both sections, or null if the
     * API call fails or returns an empty response.
     */

    const apiKey = process.env.AUTO_ADS_GOOGLE_API_KEY;
    const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";

    if (!apiKey) {
        console.error("[DESCRIPTION] AUTO_ADS_GOOGLE_API_KEY is not set");
        return null;
    }

    const systemPrompt = readPromptFile("create_description.md");
    const detailsText = buildDetailsText(details);

    // fetch all images in parallel, skip any that fail to download
    const imageParts = (
        await Promise.all(imageUrls.map(fetchImageAsPart))
    ).filter((p): p is {inlineData: {data: string; mimeType: string}} => p !== null);

    const userParts: object[] = [
        ...imageParts,
        {text: `Here are the vehicle details:\n\n${detailsText}\n\nPlease write the listing description and specs & features.`},
    ];

    const ai = new GoogleGenAI({apiKey});

    try {
        console.log(`[DESCRIPTION] Calling Gemini API: model=${modelName}, images=${imageParts.length}`);
        const startTime = Date.now();

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{
                role: "user",
                parts: userParts,
            }],
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
            },
        });

        const duration = Date.now() - startTime;
        const text = response.text?.trim() || "";
        console.log(`[DESCRIPTION] Gemini responded in ${duration}ms (${text.length} chars)`);

        if (!text) return null;

        return splitDescriptionResponse(text);
    } catch (err) {
        console.error("[DESCRIPTION] Gemini API error:", err instanceof Error ? err.message : String(err));
        return null;
    }
}

// SELL PRICE RANGE
export interface SellPriceRange {
    /** Low and high bounds of the AI-suggested retail selling price in GBP. */

    low: number;
    high: number;
}

// SUGGEST SELLING PRICE
export async function suggestSellingPrice(
    details: VehicleDetails,
    imageUrls: string[],
): Promise<SellPriceRange | null> {
    /**
     * Calls the Gemini API with the vehicle details and any available images
     * to estimate a retail selling price range. The system prompt is read from
     * suggested_selling_price.md at call time. Parses the two-line LOW/HIGH
     * response into a SellPriceRange, returning null if the API call fails or
     * the response cannot be parsed.
     */

    const apiKey = process.env.AUTO_ADS_GOOGLE_API_KEY;
    const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";

    if (!apiKey) {
        console.error("[SELL PRICE] AUTO_ADS_GOOGLE_API_KEY is not set");
        return null;
    }

    const systemPrompt = readPromptFile("suggested_selling_price.md");
    const detailsText = buildDetailsText(details);

    // fetch all images in parallel, skip any that fail to download
    const imageParts = (
        await Promise.all(imageUrls.map(fetchImageAsPart))
    ).filter((p): p is {inlineData: {data: string; mimeType: string}} => p !== null);

    const userParts: object[] = [
        ...imageParts,
        {text: `Here are the vehicle details:\n\n${detailsText}\n\nPlease suggest a selling price range.`},
    ];

    const ai = new GoogleGenAI({apiKey});

    try {
        console.log(`[SELL PRICE] Calling Gemini API: model=${modelName}, images=${imageParts.length}`);
        const startTime = Date.now();

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{
                role: "user",
                parts: userParts,
            }],
            config: {
                systemInstruction: systemPrompt,
                temperature: 0,
            },
        });

        const duration = Date.now() - startTime;
        const raw = response.text?.trim() || "";
        console.log(`[SELL PRICE] Gemini responded in ${duration}ms: "${raw}"`);

        // parse the two-line LOW: <int> / HIGH: <int> response
        const lowMatch = raw.match(/^LOW:\s*(\d+)/im);
        const highMatch = raw.match(/^HIGH:\s*(\d+)/im);

        if (!lowMatch || !highMatch) {
            console.error("[SELL PRICE] Could not parse response:", raw);
            return null;
        }

        return {low: parseInt(lowMatch[1], 10), high: parseInt(highMatch[1], 10)};
    } catch (err) {
        console.error("[SELL PRICE] Gemini API error:", err instanceof Error ? err.message : String(err));
        return null;
    }
}
