import {NextRequest, NextResponse} from "next/server";
import {getServerSessionFromCookies} from "@app/lib/session";
import {createPersistentTempDir} from "@app/anna-trainer/add-video/actions";
import * as fs from "fs/promises";
import * as path from "path";

// SANITIZE NAME
function sanitizeName(raw: string): string {
    /**
     * Sanitizes a name by removing all characters except alphanumeric, underscore, and hyphen.
     */

    return raw.replace(/[^A-Za-z0-9_-]/g, "");
}

// POST - PREPARE VIDEO FILE FROM FORMDATA
export async function POST(request: NextRequest) {
    /**
     * API route to handle file uploads via FormData.
     * Handles large files better than server actions because it doesn't require JSON serialization.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return NextResponse.json({success: false, error: "Not authenticated"}, {status: 401});
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const name = formData.get("name") as string;

        if (!file) {
            return NextResponse.json({success: false, error: "File is missing"}, {status: 400});
        }

        if (!name || !name.trim()) {
            return NextResponse.json({success: false, error: "Name is missing or empty"}, {status: 400});
        }

        // create persistent temp directory
        const tempDir = await createPersistentTempDir(session.user.userId);

        // get extension from filename
        const filename = file.name;
        const originalExtension = filename.split(".").pop()?.toLowerCase() || "mp4";
        const inputPath = path.join(tempDir, "input");
        const fullInputPath = `${inputPath}.${originalExtension}`;

        // write file directly from FormData
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(fullInputPath, buffer);

        const sanitizedName = sanitizeName(name.trim());

        return NextResponse.json({
            success: true,
            sanitizedName,
            originalExtension,
            tempDir,
        });
    } catch (error) {
        console.error("Prepare video file error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "File preparation failed",
            },
            {status: 500}
        );
    }
}

