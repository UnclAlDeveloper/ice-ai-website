"use server";

import {getAnnaTrainerDb} from "@app/lib/annaTrainerDb";
import {getServerSessionFromCookies} from "@app/lib/session";
import {AWSAccess} from "@app/lib/AwsAccess";
import {revalidatePath} from "next/cache";
import {withTempDir} from "@app/utils/tempfile";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import {runFfmpeg} from "@app/utils/ffmpegCli";
import {languages, videos, videoStages} from "../../../drizzle/anna-trainer/schema";
import {asc} from "drizzle-orm";
import type {InferInsertModel} from "drizzle-orm";

// SANITIZE NAME
function sanitizeName(raw: string): string {
    /**
     * Sanitizes a name by removing all characters except alphanumeric, underscore, and hyphen.
     */

    return raw.replace(/[^A-Za-z0-9_-]/g, "");
}

// VIDEO DEFINITION TYPE
export type VideoDefinition = Omit<
    InferInsertModel<typeof videos>,
    "id" | "owner" | "createdAt" | "updatedAt" | "rawVideoId"
>;

// GET ALL LANGUAGES
export async function getAllLanguages() {
    /**
     * Fetches all available languages from the database.
     * Returns an array of language records sorted alphabetically by name.
     */

    const result = await getAnnaTrainerDb().query.languages.findMany({
        orderBy: [asc(languages.language)],
    });

    return result;
}

// GET VIDEO STAGES
export async function getVideoStages() {
    /**
     * Fetches all video processing stages from the database.
     * Returns an array of stage records.
     */

    const result = await getAnnaTrainerDb().query.videoStages.findMany({
        orderBy: [asc(videoStages.code)],
    });

    return result;
}

// UPLOAD FILE TO S3 FROM LOCAL PATH
export async function uploadFileToS3FromPath(
    localPath: string,
    sanitizedName: string,
    extension: string,
    tempPrefix?: string,
): Promise<{success: boolean; error?: string}> {
    /**
     * Uploads a local file to S3.
     * S3 key format: public/{sanitizedName}.{extension} or public/tmp/{userId}/{tempPrefix}/{sanitizedName}.{extension} if tempPrefix is provided
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const store = new AWSAccess("anna-trainer");
        const s3Key = tempPrefix
            ? `public/tmp/${session.user.userId}/${tempPrefix}/${sanitizedName}.${extension}`
            : `public/${sanitizedName}.${extension}`;

        const fileContent = await fs.readFile(localPath);
        await store.putToS3(s3Key, fileContent);

        return {success: true};
    } catch (error) {
        console.error("S3 upload failed:", error);
        return {success: false, error: error instanceof Error ? error.message : "S3 upload failed"};
    }
}

// DOWNLOAD FILE FROM S3 TO LOCAL PATH
async function downloadFileFromS3ToPath(
    sanitizedName: string,
    extension: string,
    outputPath: string,
    tempPrefix: string,
): Promise<{success: boolean; error?: string}> {
    /**
     * Downloads a file from S3 temp location to a local path.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        const store = new AWSAccess("anna-trainer");
        const s3Key = `public/tmp/${session.user.userId}/${tempPrefix}/${sanitizedName}.${extension}`;

        const stream = await store.getS3Object(s3Key);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        await fs.writeFile(outputPath, buffer);

        return {success: true};
    } catch (error) {
        console.error("S3 download failed:", error);
        return {success: false, error: error instanceof Error ? error.message : "S3 download failed"};
    }
}

// STEP 1: PREPARE VIDEO FILE
async function stepPrepareVideoFile(
    source: {type: "file"; fileData: string; filename: string} | {type: "url"; url: string},
    name: string,
    tempDir: string,
): Promise<{
    success: boolean;
    inputPath?: string;
    originalExtension?: string;
    sanitizedName?: string;
    error?: string;
}> {
    /**
     * Step 1: Prepares video file by copying uploaded file or downloading from URL.
     */

    try {
        let originalExtension = "mp4";
        const inputPath = path.join(tempDir, "input");

        if (source.type === "file") {
            if (!source.fileData || !source.filename) {
                return {success: false, error: "File data or filename is missing"};
            }
            originalExtension = source.filename.split(".").pop()?.toLowerCase() || "mp4";
            const fullInputPath = `${inputPath}.${originalExtension}`;

            // convert base64 string back to Buffer
            const buffer = Buffer.from(source.fileData, "base64");
            await fs.writeFile(fullInputPath, buffer);

            const sanitizedName = sanitizeName(name);
            return {
                success: true,
                inputPath: fullInputPath,
                originalExtension,
                sanitizedName,
            };
        } else {
            const urlObj = new URL(source.url);
            const urlPath = urlObj.pathname;
            const urlExtension = urlPath.split(".").pop()?.toLowerCase() || "mp4";
            originalExtension = urlExtension;

            const fullInputPath = `${inputPath}.${originalExtension}`;
            const downloadResult = await downloadFromUrl(source.url, fullInputPath);
            if (!downloadResult.success) {
                return {success: false, error: downloadResult.error || "Download failed"};
            }

            const sanitizedName = sanitizeName(name);
            return {
                success: true,
                inputPath: fullInputPath,
                originalExtension,
                sanitizedName,
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "File preparation failed",
        };
    }
}

// STEP 2: CONVERT TO MP4
async function stepConvertToMp4(
    inputPath: string,
    originalExtension: string,
    sanitizedName: string,
    tempDir: string,
): Promise<{
    success: boolean;
    mp4Path?: string;
    mp4Filename?: string;
    error?: string;
}> {
    /**
     * Step 2: Converts video to MP4 format if needed.
     */

    try {
        const mp4Path = path.join(tempDir, "output.mp4");
        const needsMp4 = originalExtension !== "mp4";

        if (needsMp4) {
            const convertResult = await convertToMp4(inputPath, mp4Path);
            if (!convertResult.success) {
                return {success: false, error: convertResult.error || "MP4 conversion failed"};
            }
        } else {
            await fs.copyFile(inputPath, mp4Path);
        }

        const mp4Filename = `${sanitizedName}.mp4`;
        return {success: true, mp4Path, mp4Filename};
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "MP4 conversion failed",
        };
    }
}

// STEP 3: EXTRACT AUDIO TO MP3
async function stepExtractAudioToMp3(
    mp4Path: string,
    sanitizedName: string,
    tempDir: string,
): Promise<{
    success: boolean;
    mp3Path?: string;
    mp3Filename?: string;
    error?: string;
}> {
    /**
     * Step 3: Extracts audio from MP4 video as MP3.
     */

    try {
        const mp3Path = path.join(tempDir, "output.mp3");
        const mp3Result = await convertToMp3(mp4Path, mp3Path);
        if (!mp3Result.success) {
            return {success: false, error: mp3Result.error || "MP3 extraction failed"};
        }

        const mp3Filename = `${sanitizedName}.mp3`;
        return {success: true, mp3Path, mp3Filename};
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "MP3 extraction failed",
        };
    }
}

// STEP 4: UPLOAD TO S3
async function stepUploadToS3(
    mp4Path: string,
    mp3Path: string,
    sanitizedName: string,
    mp4Filename: string,
    mp3Filename: string,
): Promise<{
    success: boolean;
    mp4Filename?: string;
    mp3Filename?: string;
    error?: string;
}> {
    /**
     * Step 4: Uploads MP4 and MP3 files to S3.
     */

    try {
        // upload MP4 to S3
        const mp4UploadResult = await uploadFileToS3FromPath(mp4Path, sanitizedName, "mp4");
        if (!mp4UploadResult.success) {
            return {success: false, error: mp4UploadResult.error || "MP4 upload failed"};
        }

        // upload MP3 to S3
        const mp3UploadResult = await uploadFileToS3FromPath(mp3Path, sanitizedName, "mp3");
        if (!mp3UploadResult.success) {
            return {success: false, error: mp3UploadResult.error || "MP3 upload failed"};
        }

        return {success: true, mp4Filename, mp3Filename};
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Upload failed",
        };
    }
}

// CREATE PERSISTENT TEMP DIRECTORY
export async function createPersistentTempDir(userId: string): Promise<string> {
    /**
     * Creates a persistent temp directory that will remain between server action calls.
     * Returns the path to the temp directory.
     */

    const tempBaseDir = path.join(os.tmpdir(), "anna-trainer", userId);
    await fs.mkdir(tempBaseDir, {recursive: true});

    const tempDir = path.join(tempBaseDir, `process-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tempDir, {recursive: true});

    return tempDir;
}

// CLEANUP TEMP DIRECTORY
export async function cleanupTempDirectory(tempDir: string): Promise<void> {
    /**
     * Cleans up a persistent temp directory and its contents.
     */

    try {
        await fs.rm(tempDir, {recursive: true, force: true});
    } catch (error) {
        console.error("Failed to cleanup temp directory:", error);
        // non-fatal, continue
    }
}

// STEP 1: PREPARE VIDEO FILE (exported for client to call)
export async function prepareVideoFile(
    source: {type: "file"; fileData: string; filename: string} | {type: "url"; url: string},
    name: string,
): Promise<{
    success: boolean;
    sanitizedName?: string;
    originalExtension?: string;
    tempDir?: string;
    error?: string;
}> {
    /**
     * Step 1: Prepares video file by copying uploaded file or downloading from URL.
     * Creates a persistent temp directory that will be used for all subsequent steps.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        // create persistent temp directory
        const tempDir = await createPersistentTempDir(session.user.userId);

        const prepareResult = await stepPrepareVideoFile(source, name, tempDir);
        if (!prepareResult.success || !prepareResult.inputPath || !prepareResult.sanitizedName) {
            await cleanupTempDirectory(tempDir);
            return {success: false, error: prepareResult.error || "File preparation failed"};
        }

        return {
            success: true,
            sanitizedName: prepareResult.sanitizedName,
            originalExtension: prepareResult.originalExtension,
            tempDir,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "File preparation failed",
        };
    }
}

// STEP 2: CONVERT TO MP4 (exported for client to call)
export async function convertVideoToMp4(
    sanitizedName: string,
    originalExtension: string,
    tempDir: string,
): Promise<{
    success: boolean;
    mp4Filename?: string;
    tempDir?: string;
    error?: string;
}> {
    /**
     * Step 2: Converts video to MP4 format.
     * Uses the persistent temp directory from step 1.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        // find the input file in the temp directory
        const inputPath = path.join(tempDir, `input.${originalExtension}`);
        
        // verify file exists
        try {
            await fs.access(inputPath);
        } catch {
            return {success: false, error: "Input file not found in temp directory"};
        }

        // convert to MP4
        const mp4Result = await stepConvertToMp4(inputPath, originalExtension, sanitizedName, tempDir);
        if (!mp4Result.success || !mp4Result.mp4Path || !mp4Result.mp4Filename) {
            return {success: false, error: mp4Result.error || "MP4 conversion failed"};
        }

        return {
            success: true,
            mp4Filename: mp4Result.mp4Filename,
            tempDir,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "MP4 conversion failed",
        };
    }
}

// STEP 3: EXTRACT AUDIO TO MP3 (exported for client to call)
export async function extractAudioToMp3(
    sanitizedName: string,
    tempDir: string,
): Promise<{
    success: boolean;
    mp3Filename?: string;
    tempDir?: string;
    error?: string;
}> {
    /**
     * Step 3: Extracts audio from MP4 as MP3.
     * Uses the persistent temp directory from previous steps.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        // find the MP4 file in the temp directory
        const mp4Path = path.join(tempDir, "output.mp4");
        
        // verify file exists
        try {
            await fs.access(mp4Path);
        } catch {
            return {success: false, error: "MP4 file not found in temp directory"};
        }

        // extract audio to MP3
        const mp3Result = await stepExtractAudioToMp3(mp4Path, sanitizedName, tempDir);
        if (!mp3Result.success || !mp3Result.mp3Path || !mp3Result.mp3Filename) {
            return {success: false, error: mp3Result.error || "MP3 extraction failed"};
        }

        return {
            success: true,
            mp3Filename: mp3Result.mp3Filename,
            tempDir,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "MP3 extraction failed",
        };
    }
}

// STEP 4: UPLOAD FINAL FILES TO S3 (exported for client to call)
export async function uploadFinalFilesToS3(
    sanitizedName: string,
    tempDir: string,
    mp4Filename: string,
    mp3Filename: string,
): Promise<{
    success: boolean;
    mp4Filename?: string;
    mp3Filename?: string;
    error?: string;
}> {
    /**
     * Step 4: Uploads final MP4 and MP3 files from temp directory to final S3 location.
     * Also cleans up the temp directory after successful upload.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    try {
        // find files in temp directory
        const mp4Path = path.join(tempDir, "output.mp4");
        const mp3Path = path.join(tempDir, "output.mp3");

        // verify files exist
        try {
            await fs.access(mp4Path);
            await fs.access(mp3Path);
        } catch {
            return {success: false, error: "Output files not found in temp directory"};
        }

        // upload to final S3 location
        const uploadResult = await stepUploadToS3(mp4Path, mp3Path, sanitizedName, mp4Filename, mp3Filename);
        if (!uploadResult.success) {
            return {success: false, error: uploadResult.error || "Final upload failed"};
        }

        // cleanup temp directory after successful upload
        await cleanupTempDirectory(tempDir);

        return {
            success: true,
            mp4Filename: uploadResult.mp4Filename,
            mp3Filename: uploadResult.mp3Filename,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Upload failed",
        };
    }
}

// PROCESS VIDEO LOCALLY (all steps in sequence - kept for backward compatibility)
export async function processVideoLocally(
    source: {type: "file"; fileData: string; filename: string} | {type: "url"; url: string},
    name: string,
): Promise<{
    success: boolean;
    mp4Filename?: string;
    mp3Filename?: string;
    error?: string;
}> {
    /**
     * Processes a video locally through all steps: prepare, convert to MP4, extract MP3, upload to S3.
     * All processing happens in a single temp directory that is cleaned up automatically.
     * This is a convenience function that calls all steps in sequence.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, error: "Not authenticated"};
    }

    return await withTempDir(async (tempDir) => {
        // step 1: prepare video file
        const prepareResult = await stepPrepareVideoFile(source, name, tempDir);
        if (!prepareResult.success || !prepareResult.inputPath || !prepareResult.sanitizedName) {
            return {success: false, error: prepareResult.error || "File preparation failed"};
        }

        // step 2: convert to MP4
        const mp4Result = await stepConvertToMp4(
            prepareResult.inputPath,
            prepareResult.originalExtension || "mp4",
            prepareResult.sanitizedName,
            tempDir,
        );
        if (!mp4Result.success || !mp4Result.mp4Path || !mp4Result.mp4Filename) {
            return {success: false, error: mp4Result.error || "MP4 conversion failed"};
        }

        // step 3: extract audio to MP3
        const mp3Result = await stepExtractAudioToMp3(mp4Result.mp4Path, prepareResult.sanitizedName, tempDir);
        if (!mp3Result.success || !mp3Result.mp3Path || !mp3Result.mp3Filename) {
            return {success: false, error: mp3Result.error || "MP3 extraction failed"};
        }

        // step 4: upload to S3
        const uploadResult = await stepUploadToS3(
            mp4Result.mp4Path,
            mp3Result.mp3Path,
            prepareResult.sanitizedName,
            mp4Result.mp4Filename,
            mp3Result.mp3Filename,
        );
        if (!uploadResult.success) {
            return {success: false, error: uploadResult.error || "Upload failed"};
        }

        return {
            success: true,
            mp4Filename: uploadResult.mp4Filename,
            mp3Filename: uploadResult.mp3Filename,
        };
    }, "video-process-");
}

// DOWNLOAD FROM URL
async function downloadFromUrl(
    url: string,
    outputPath: string,
): Promise<{success: boolean; error?: string}> {
    /**
     * Downloads a video from a URL to a local file path.
     */

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(outputPath, buffer);

        return {success: true};
    } catch (error) {
        console.error("URL download failed:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "URL download failed",
        };
    }
}

// UPLOAD FROM GOOGLE DRIVE
export async function uploadFromGoogleDrive(
    fileId: string,
    fileName: string,
    name: string,
    accessToken: string,
): Promise<{success: boolean; filename: string; error?: string}> {
    /**
     * Downloads a video from Google Drive and uploads it to S3.
     * This is a placeholder for the actual implementation.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, filename: "", error: "Not authenticated"};
    }

    // TODO: Implement Google Drive download and S3 upload
    // This would involve:
    // 1. Using the Google Drive API with the access token
    // 2. Downloading the file
    // 3. Uploading to S3

    console.log("uploadFromGoogleDrive - placeholder implementation", {fileId, fileName, name});
    return {success: false, filename: "", error: "Google Drive upload not yet implemented"};
}

// CONVERT TO MP4
export async function convertToMp4(
    inputPath: string,
    outputPath: string,
): Promise<{success: boolean; error?: string}> {
    /**
     * Converts a video file to MP4 format using ffmpeg (ffmpeg-static binary).
     * Works with local file paths.
     */

    const result = await runFfmpeg([
        "-i",
        inputPath,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-preset",
        "medium",
        "-crf",
        "23",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        "-y",
        outputPath,
    ]);

    if (!result.success) {
        console.error("MP4 conversion failed:", result.error);
    }

    return result.success ? {success: true} : {success: false, error: result.error};
}

// CONVERT TO MP3
export async function convertToMp3(
    inputPath: string,
    outputPath: string,
): Promise<{success: boolean; error?: string}> {
    /**
     * Extracts audio from a video file as MP3 using ffmpeg (ffmpeg-static binary).
     * Works with local file paths.
     */

    const result = await runFfmpeg([
        "-i",
        inputPath,
        "-vn",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "192k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-y",
        outputPath,
    ]);

    if (!result.success) {
        console.error("MP3 extraction failed:", result.error);
    }

    return result.success ? {success: true} : {success: false, error: result.error};
}

// TRANSCRIBE AUDIO
export async function transcribeAudio(
    audioFilename: string,
    languageCode: string,
): Promise<{success: boolean; transcript: string; detectedLanguage?: string; error?: string}> {
    /**
     * Transcribes an audio file using ElevenLabs or similar service.
     * This is a placeholder for the actual implementation.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        return {success: false, transcript: "", error: "Not authenticated"};
    }

    // TODO: Implement audio transcription
    // This would involve:
    // 1. Downloading the audio file from S3
    // 2. Sending to transcription service (ElevenLabs, AWS Transcribe, etc.)
    // 3. Returning the transcript and detected language

    console.log("transcribeAudio - placeholder implementation", {audioFilename, languageCode});
    return {success: false, transcript: "", error: "Transcription not yet implemented"};
}

// GET VIDEO URL
export async function getVideoUrl(filename: string): Promise<string> {
    /**
     * Constructs the public URL for a video file in S3.
     * Filename should already be in the format: {sanitizedName}.{extension}
     * S3 key format: public/{filename}
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        throw new Error("Not authenticated");
    }

    const store = new AWSAccess("anna-trainer");
    const s3Key = `public/${filename}`;

    return `https://${store.bucketName}.s3.${store.awsRegionName}.amazonaws.com/${s3Key}`;
}

// SAVE VIDEO
export async function saveVideo(videoDefinition: VideoDefinition) {
    /**
     * Saves a video definition to the database.
     * Creates a new video record with the provided details.
     */

    const session = await getServerSessionFromCookies();
    if (!session) {
        throw new Error("Not authenticated");
    }

    const [video] = await getAnnaTrainerDb()
        .insert(videos)
        .values({
            ...videoDefinition,
            owner: session.user.userId,
        })
        .returning();

    const videoWithRelations = await getAnnaTrainerDb().query.videos.findFirst({
        where: (videos, {eq}) => eq(videos.id, video.id),
        with: {
            language: true,
            stage: true,
        },
    });

    revalidatePath("/anna-trainer/add-video");

    return videoWithRelations!;
}
