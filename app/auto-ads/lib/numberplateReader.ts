import {GoogleGenAI} from "@google/genai";

// SYSTEM PROMPT
const SYSTEM_PROMPT = `You are a UK vehicle numberplate reader. You will be given an image of a car. Your job is to identify and return the vehicle's numberplate (registration plate) text.

Rules:
- Look for the numberplate in the image. It is typically a rectangular plate on the front or rear of the vehicle.
- Return ONLY the numberplate text, with no extra characters, no explanation, and no formatting.
- Use uppercase letters and include the space in the standard position (e.g. "AB12 CDE").
- If you cannot find a numberplate, or the image does not contain a vehicle, or the plate is unreadable, return exactly the word "NONE".
- Never guess. If any characters are ambiguous or obscured, return "NONE".`;

// READ NUMBERPLATE FROM BUFFER
export async function readNumberplateFromBuffer(imageBuffer: Buffer, mimeType: string): Promise<string | null> {
    /**
     * Sends a raw image buffer to Gemini and asks it to read the vehicle
     * numberplate. Returns the plate text or null if no plate was found.
     */

    const base64 = imageBuffer.toString("base64");
    return callGeminiForNumberplate({
        inlineData: {data: base64, mimeType},
    });
}

// READ NUMBERPLATE FROM URL
export async function readNumberplateFromUrl(imageUrl: string): Promise<string | null> {
    /**
     * Fetches an image from a URL and sends it to Gemini to read the
     * vehicle numberplate. Returns the plate text or null if unreadable.
     */

    const response = await fetch(imageUrl);
    if (!response.ok) {
        console.error(`[NUMBERPLATE] Failed to fetch image from URL: ${response.status}`);
        return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // s3 often returns application/octet-stream, so infer from the url extension
    let mimeType = response.headers.get("content-type") || "";
    if (!mimeType || mimeType === "application/octet-stream" || mimeType === "binary/octet-stream") {
        const ext = imageUrl.split("?")[0].split(".").pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
            jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
            gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
        };
        mimeType = (ext && mimeMap[ext]) || "image/jpeg";
    }

    return readNumberplateFromBuffer(buffer, mimeType);
}

// IMAGE PART
interface ImagePart {
    inlineData: {data: string; mimeType: string};
}

// CALL GEMINI FOR NUMBERPLATE
async function callGeminiForNumberplate(imagePart: ImagePart): Promise<string | null> {
    /**
     * Core function that sends an image to the Gemini API with a prompt
     * to extract the numberplate. Returns the cleaned plate string, or
     * null when the model responds with "NONE" or fails.
     */

    const apiKey = process.env.AUTO_ADS_GOOGLE_API_KEY;
    const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";

    if (!apiKey) {
        console.error("[NUMBERPLATE] AUTO_ADS_GOOGLE_API_KEY is not set");
        return null;
    }

    const ai = new GoogleGenAI({apiKey});

    try {
        console.log(`[NUMBERPLATE] Calling Gemini API: model=${modelName}`);
        const startTime = Date.now();

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{
                role: "user",
                parts: [
                    imagePart,
                    {text: "Read the numberplate from this vehicle image."},
                ],
            }],
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0,
            },
        });

        const duration = Date.now() - startTime;
        const raw = response.text?.trim() || "";
        console.log(`[NUMBERPLATE] Gemini responded in ${duration}ms: "${raw}"`);

        if (!raw || raw.toUpperCase() === "NONE") {
            return null;
        }

        // strip any accidental quotes or punctuation the model may add
        const cleaned = raw.replace(/[^A-Za-z0-9 ]/g, "").trim().toUpperCase();
        return cleaned || null;
    } catch (err) {
        console.error("[NUMBERPLATE] Gemini API error:", err instanceof Error ? err.message : String(err));
        return null;
    }
}
