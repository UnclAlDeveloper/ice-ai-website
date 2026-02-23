import {GoogleGenAI} from "@google/genai";

// SEARCH FILTERS
export interface SearchFilters {
    /**
     * Structured filters extracted from a natural language search query.
     * Null fields indicate the user did not specify that criterion.
     */

    makeAndModel: string | null;
    minPrice: number | null;
    maxPrice: number | null;
    minMileage: number | null;
    maxMileage: number | null;
    minYear: number | null;
    maxYear: number | null;
    fuelType: string | null;
    bodyType: string | null;
    gearboxType: string | null;
    colour: string | null;
    location: string | null;
    campervanConversion: boolean;
    suggestedOnly: boolean;
    freeText: string;
}

// EMPTY FILTERS
const emptyFilters = (freeText: string): SearchFilters => ({
    /**
     * Returns a SearchFilters object with all structured fields set to null
     * and the original query preserved as freeText for semantic reranking.
     */

    makeAndModel: null,
    minPrice: null,
    maxPrice: null,
    minMileage: null,
    maxMileage: null,
    minYear: null,
    maxYear: null,
    fuelType: null,
    bodyType: null,
    gearboxType: null,
    colour: null,
    location: null,
    campervanConversion: false,
    suggestedOnly: false,
    freeText,
});

// SYSTEM PROMPT
const SYSTEM_PROMPT = `You are a search query parser for a vehicle listings database. Your job is to extract structured filters from natural language search queries about vehicles (mostly vans and commercial vehicles).

The database has these filterable columns:
- makeAndModel (text): Vehicle make and model, e.g. "Ford Transit", "Mercedes Sprinter", "Vauxhall Vivaro", "Citroen Relay"
- askingPrice (integer): Price in GBP (pounds sterling)
- mileage (integer): In miles
- year (integer): Manufacturing year, e.g. 2018
- fuelType (text): e.g. "Diesel", "Petrol", "Electric"
- bodyType (text): e.g. "Panel Van", "Chassis Cab", "Luton", "Tipper", "Dropside", "Box Van"
- gearboxType (text): e.g. "Manual", "Automatic"
- colour (text): e.g. "White", "Silver", "Blue", "Red"
- location (text): UK locations, e.g. "Manchester", "London", "Birmingham"
- aiCampervanConversion (text, nullable): Contains AI analysis of campervan conversion potential. Only present on some listings.

Parse the user's search query and return ONLY valid JSON (no markdown, no code fences) matching this exact schema:
{
  "makeAndModel": "string or null",
  "minPrice": "number or null",
  "maxPrice": "number or null",
  "minMileage": "number or null",
  "maxMileage": "number or null",
  "minYear": "number or null",
  "maxYear": "number or null",
  "fuelType": "string or null",
  "bodyType": "string or null",
  "gearboxType": "string or null",
  "colour": "string or null",
  "location": "string or null",
  "campervanConversion": "boolean, true if the query relates to campervan conversion",
  "suggestedOnly": "boolean, true if the query asks for suggested or recommended listings",
  "freeText": "remaining query text that does not map to any structured field, or empty string"
}

Rules:
- For price, "less than 3,000" or "under 3000" or "cheap" means maxPrice. "More than 5,000" or "over 5000" means minPrice. "Cheap" should set maxPrice to around 3000.
- For mileage, "low mileage" or "under 100k miles" means maxMileage. Convert "100k" to 100000.
- For year, "newer than 2015" or "2015 onwards" means minYear=2015. A range like "2015 to 2020" means minYear=2015, maxYear=2020.
- The makeAndModel should be the canonical make and model name, e.g. "Ford Transit" not "ford transits".
- If the query mentions campervan, camper van, camper conversion, van conversion, camping conversion, or similar terms, set campervanConversion to true. This filters to only listings that have campervan conversion analysis.
- If the query mentions "suggested", "recommended", "good deal", "good deals", "undervalued", "below market value", "bargain", or similar terms indicating the user wants listings priced below their estimated value, set suggestedOnly to true. This filters to listings where the asking price is below the AI-estimated buy price.
- Any part of the query that describes subjective qualities, conditions, features, or anything not mappable to the structured columns should go in freeText.
- If the entire query is subjective (e.g. "good condition van for camping"), put it all in freeText.
- Remove generic vehicle type terms from freeText: exclude generic words like "van", "vehicle", "car", "truck", "motor vehicle" since they are too generic and don't add semantic value for reranking. However, keep specific compound terms like "campervan", "motorhome", "tipper van", "box van", "panel van" that have specific meaning and should be preserved in the semantic search.
- Always return valid JSON. Never include explanations outside the JSON.`;

// PARSE SEARCH RESULT
export interface ParseSearchResult {
    /**
     * Result of parsing a search query. filters is always present; error is set
     * when a Google API error occurred but we fell back to freeText-only mode.
     */

    filters: SearchFilters;
    error?: string;
}

// FORMAT ERROR
function formatError(err: unknown): string {
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

// IS GOOGLE API ERROR
function isGoogleApiError(err: unknown): boolean {
    /**
     * Returns true if the error appears to be from the Google/Gemini API
     * (e.g. quota exceeded, rate limit, internal server errors, API key issues).
     */

    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();
    const name = err instanceof Error ? err.constructor.name.toLowerCase() : "";
    return (
        name === "apierror" ||
        lower.includes("generativelanguage") ||
        lower.includes("ai.google.dev") ||
        lower.includes("gemini") ||
        lower.includes("resource_exhausted") ||
        lower.includes("429") ||
        lower.includes("quota") ||
        lower.includes("rate limit") ||
        lower.includes("internal error") ||
        lower.includes("\"code\":500") ||
        lower.includes("\"status\":\"internal\"")
    );
}

// IS RETRYABLE ERROR
function isRetryableError(err: unknown): boolean {
    /**
     * Returns true if the error is a transient server-side error that is
     * likely to succeed on retry (e.g. HTTP 500, 503, or rate limits).
     */

    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();
    return (
        lower.includes("\"code\":500") ||
        lower.includes("\"code\":503") ||
        lower.includes("internal error") ||
        lower.includes("\"status\":\"internal\"") ||
        lower.includes("\"status\":\"unavailable\"") ||
        lower.includes("resource_exhausted") ||
        lower.includes("429") ||
        lower.includes("rate limit")
    );
}

// SLEEP
function sleep(ms: number): Promise<void> {
    /**
     * Returns a promise that resolves after the given number of milliseconds.
     */

    return new Promise((resolve) => setTimeout(resolve, ms));
}

// CALL GEMINI API
async function callGeminiApi(
    ai: InstanceType<typeof GoogleGenAI>,
    modelName: string,
    query: string,
): Promise<SearchFilters> {
    /**
     * Calls the Gemini API to parse a natural language query into structured
     * SearchFilters. Handles response parsing and validation. Throws on any
     * API or JSON parsing failure.
     */

    console.log(`[SEARCH] Calling Google Gemini API: model=${modelName}, query="${query.substring(0, 80)}"`);
    const apiStartTime = Date.now();

    const response = await ai.models.generateContent({
        model: modelName,
        contents: query,
        config: {
            systemInstruction: SYSTEM_PROMPT,
            temperature: 0,
            responseMimeType: "application/json",
        },
    });

    const apiDuration = Date.now() - apiStartTime;

    // log the full response for debugging (responses are small JSON objects)
    console.log(`[SEARCH] Google API responded in ${apiDuration}ms:`, JSON.stringify({
        model: modelName,
        query: query.substring(0, 100),
        hasText: !!response.text,
        textLength: response.text?.length || 0,
        fullText: response.text || null,
    }));

    const text = response.text?.trim() || "";

    // strip any markdown code fences gemini might add despite instructions
    const jsonStr = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

    const parsed = JSON.parse(jsonStr);

    // validate and coerce the parsed result
    const filters: SearchFilters = {
        makeAndModel: typeof parsed.makeAndModel === "string" ? parsed.makeAndModel : null,
        minPrice: typeof parsed.minPrice === "number" ? parsed.minPrice : null,
        maxPrice: typeof parsed.maxPrice === "number" ? parsed.maxPrice : null,
        minMileage: typeof parsed.minMileage === "number" ? parsed.minMileage : null,
        maxMileage: typeof parsed.maxMileage === "number" ? parsed.maxMileage : null,
        minYear: typeof parsed.minYear === "number" ? parsed.minYear : null,
        maxYear: typeof parsed.maxYear === "number" ? parsed.maxYear : null,
        fuelType: typeof parsed.fuelType === "string" ? parsed.fuelType : null,
        bodyType: typeof parsed.bodyType === "string" ? parsed.bodyType : null,
        gearboxType: typeof parsed.gearboxType === "string" ? parsed.gearboxType : null,
        colour: typeof parsed.colour === "string" ? parsed.colour : null,
        location: typeof parsed.location === "string" ? parsed.location : null,
        campervanConversion: parsed.campervanConversion === true,
        suggestedOnly: parsed.suggestedOnly === true,
        freeText: typeof parsed.freeText === "string" ? parsed.freeText : "",
    };

    // log active filters for debugging
    const activeFilters = Object.entries(filters).filter(
        ([, v]) => v !== null && v !== false && v !== ""
    );
    console.log(`[SEARCH] Parsed filters:`, JSON.stringify(activeFilters));

    return filters;
}

// MAX RETRIES
const MAX_RETRIES = 2;

// INITIAL RETRY DELAY MS
const INITIAL_RETRY_DELAY_MS = 500;

// PARSE SEARCH QUERY
export async function parseSearchQuery(query: string): Promise<ParseSearchResult> {
    /**
     * Sends the natural language query to Gemini to extract structured filters.
     * Retries up to MAX_RETRIES times on transient server errors (500, 503, rate
     * limits) with exponential backoff. On persistent Google API errors, returns
     * empty filters plus an error message so the search can continue using
     * semantic reranking only. Other errors are re-thrown.
     */

    const apiKey = process.env.AUTO_ADS_GOOGLE_API_KEY;
    const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";

    if (!apiKey) {
        console.error("AUTO_ADS_GOOGLE_API_KEY is not set");
        return {filters: emptyFilters(query)};
    }

    const ai = new GoogleGenAI({apiKey});
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                console.log(`[SEARCH] Retry ${attempt}/${MAX_RETRIES} after ${delayMs}ms delay`);
                await sleep(delayMs);
            }

            const filters = await callGeminiApi(ai, modelName, query);
            return {filters};
        } catch (err) {
            lastError = err;

            // log detailed error information for debugging
            console.error(`[SEARCH] Gemini API attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, {
                error: err,
                errorType: err instanceof Error ? err.constructor.name : typeof err,
                errorMessage: err instanceof Error ? err.message : String(err),
                errorStack: err instanceof Error ? err.stack : undefined,
                query: query.substring(0, 100),
                isGoogleApiError: isGoogleApiError(err),
                isRetryable: isRetryableError(err),
            });

            // only retry on transient errors, bail immediately on others
            if (!isRetryableError(err) || attempt === MAX_RETRIES) {
                break;
            }
        }
    }

    // all retries exhausted or non-retryable error
    if (isGoogleApiError(lastError)) {
        return {filters: emptyFilters(query), error: formatError(lastError)};
    }
    throw lastError;
}
