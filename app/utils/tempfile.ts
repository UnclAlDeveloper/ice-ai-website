import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

// WITH TEMP FILE
export async function withTempFile<T>(
    callback: (filePath: string) => Promise<T>,
    prefix: string = "temp-",
    suffix: string = "",
): Promise<T> {
    /**
     * Creates a temporary file, executes callback, then cleans up.
     * Similar to Python's tempfile.NamedTemporaryFile context manager.
     */

    const tempFile = path.join(
        os.tmpdir(),
        `${prefix}${Date.now()}-${Math.random().toString(36).substring(7)}${suffix}`,
    );

    try {
        return await callback(tempFile);
    } finally {
        await fs.unlink(tempFile).catch(() => {});
    }
}

// WITH TEMP DIRECTORY
export async function withTempDir<T>(
    callback: (dirPath: string) => Promise<T>,
    prefix: string = "temp-",
): Promise<T> {
    /**
     * Creates a temporary directory, executes callback, then cleans up.
     * Similar to Python's tempfile.TemporaryDirectory context manager.
     */

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));

    try {
        return await callback(tempDir);
    } finally {
        await fs.rm(tempDir, {recursive: true, force: true}).catch(() => {});
    }
}
