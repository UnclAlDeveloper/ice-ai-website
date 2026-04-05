import {spawn} from "node:child_process";
import ffmpegStatic from "ffmpeg-static";

// RUN FFMPEG
/**
 * Runs the bundled ffmpeg static binary with the given argument list.
 * Replaces fluent-ffmpeg with a thin spawn wrapper for server-side transcoding.
 */

function getFfmpegPath(): string {
    /**
     * Resolves the path to the ffmpeg binary from ffmpeg-static, or throws if unavailable.
     */

    if (!ffmpegStatic) {
        throw new Error("ffmpeg-static did not provide a binary for this platform.");
    }

    return ffmpegStatic;
}

export function runFfmpeg(args: string[]): Promise<{success: true} | {success: false; error: string}> {
    /**
     * Spawns ffmpeg with args; resolves when the process exits successfully.
     */

    return new Promise((resolve) => {
        // spawn bundled ffmpeg
        const child = spawn(getFfmpegPath(), args, {
            windowsHide: true,
        });

        const stderrChunks: Buffer[] = [];

        child.stderr?.on("data", (chunk: Buffer) => {
            stderrChunks.push(chunk);
        });

        child.on("error", (error: Error) => {
            resolve({success: false, error: error.message || "ffmpeg failed to start"});
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve({success: true});
                return;
            }

            const detail = Buffer.concat(stderrChunks).toString("utf8").trim();
            resolve({
                success: false,
                error: detail || `ffmpeg exited with code ${code ?? "unknown"}`,
            });
        });
    });
}
