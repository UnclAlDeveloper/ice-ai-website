import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import {SNSClient, PublishCommand} from "@aws-sdk/client-sns";
import {SSMClient, GetParameterCommand} from "@aws-sdk/client-ssm";
import {Readable} from "stream";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as zlib from "zlib";
import {promisify} from "util";

const gunzip = promisify(zlib.gunzip);
const gzip = promisify(zlib.gzip);

// GET ENV VARIABLE
function getEnvVariable(name: string): string | undefined {
    /**
     * Gets an environment variable value or returns undefined if not set.
     */

    return process.env[name];
}

// AWS ACCESS INTERFACE
interface AWSAccessConfig {
    /**
     * Configuration interface for AWS access credentials and paths.
     */

    bucketName: string;
    environment?: string;
    awsAccessKeyId?: string;
    awsAccountId?: string;
    awsSecretAccessKey?: string;
    awsSessionToken?: string;
    awsRegionName?: string;
    specificPath?: string;
    dataPath: string;
    mediaPath: string;
    objectsPath: string;
    snsAlertTopic?: string;
}

// AWS ACCESS
export class AWSAccess {
    /**
     * AWS interface class that provides methods for interacting with S3, storing and retrieving objects, dataframes, and models.
     */

    bucketName: string;
    environment?: string;
    awsAccessKeyId?: string;
    awsAccountId?: string;
    awsSecretAccessKey?: string;
    awsSessionToken?: string;
    awsRegionName?: string;
    specificPath?: string;
    dataPath: string;
    mediaPath: string;
    objectsPath: string;
    snsAlertTopic?: string;

    constructor(
        bucketName: string,
        subDirectoryName?: string,
        environment?: string,
        objectsDir: string = "Objects",
        dataDir: string = "Data",
        mediaDir: string = "Media",
        specificDir?: string,
        awsAccountId?: string,
        awsAccessKeyId?: string,
        awsSecretAccessKey?: string,
        awsSessionToken?: string,
        awsRegionName?: string,
        snsAlertTopic?: string,
    ) {
        /**
         * Initialize the AWS interface with credentials, bucket configuration, and directory paths for organizing stored objects and data.
         */

        const dataPath = dataDir + (subDirectoryName ? `/${subDirectoryName}` : "");
        const mediaPath = mediaDir + (subDirectoryName ? `/${subDirectoryName}` : "");
        const objectsPath = objectsDir + (subDirectoryName ? `/${subDirectoryName}` : "");
        const specificPath = specificDir ? specificDir + (subDirectoryName ? `/${subDirectoryName}` : "") : undefined;

        this.awsAccessKeyId = awsAccessKeyId || getEnvVariable("AWS_ACCESS_KEY_ID");
        this.awsAccountId = awsAccountId || getEnvVariable("AWS_ACCOUNT_ID");
        this.awsSecretAccessKey = awsSecretAccessKey || getEnvVariable("AWS_SECRET_ACCESS_KEY");
        this.awsSessionToken = awsSessionToken;
        this.awsRegionName = awsRegionName || getEnvVariable("AWS_REGION_NAME");
        this.bucketName = bucketName;
        this.environment = environment;
        this.dataPath = dataPath;
        this.mediaPath = mediaPath;
        this.objectsPath = objectsPath;
        this.specificPath = specificPath;
        this.snsAlertTopic = snsAlertTopic || getEnvVariable("SNS_ALERT_TOPIC");
    }

    // GET AWS CLIENT
    private _getS3Client(): S3Client {
        /**
         * Get an AWS S3 client configured with credentials and region.
         */

        return new S3Client({
            credentials: {
                accessKeyId: this.awsAccessKeyId || "",
                secretAccessKey: this.awsSecretAccessKey || "",
                sessionToken: this.awsSessionToken,
            },
            region: this.awsRegionName,
        });
    }

    // GET AWS SNS CLIENT
    private _getSNSClient(): SNSClient {
        /**
         * Get an AWS SNS client configured with credentials and region.
         */

        return new SNSClient({
            credentials: {
                accessKeyId: this.awsAccessKeyId || "",
                secretAccessKey: this.awsSecretAccessKey || "",
                sessionToken: this.awsSessionToken,
            },
            region: this.awsRegionName,
        });
    }

    // GET AWS SSM CLIENT
    private _getSSMClient(): SSMClient {
        /**
         * Get an AWS SSM client configured with credentials and region.
         */

        return new SSMClient({
            credentials: {
                accessKeyId: this.awsAccessKeyId || "",
                secretAccessKey: this.awsSecretAccessKey || "",
                sessionToken: this.awsSessionToken,
            },
            region: this.awsRegionName,
        });
    }

    // GET S3 OBJECT
    async getS3Object(key: string): Promise<Readable> {
        /**
         * Get an S3 object by key and return a readable stream.
         */

        const client = this._getS3Client();
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });
        const response = await client.send(command);
        return response.Body as Readable;
    }

    // GET MEDIA
    async getMedia(name: string, mediaType: string): Promise<Buffer> {
        /**
         * Download and return the raw bytes of a media file from the S3 media path.
         */

        const key = path.join(this.mediaPath, `${name}.${mediaType}`).replace(/\\/g, "/");
        const stream = await this.getS3Object(key);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    // GET MEDIA URL
    getMediaUrl(name: string, mediaType: string): string {
        /**
         * Get the full S3 URL for a media file.
         */

        const key = path.join(this.mediaPath, `${name}.${mediaType}`).replace(/\\/g, "/");
        return `https://${this.bucketName}.s3.${this.awsRegionName}.amazonaws.com/${key}`;
    }

    // DOWNLOAD MEDIA TO FILE
    async downloadMediaToFile(name: string, filename: string, mediaType: string): Promise<void> {
        /**
         * Download and save a media file from the S3 media path to a local file.
         */

        const key = path.join(this.mediaPath, `${name}.${mediaType}`).replace(/\\/g, "/");
        await this.downloadFileFromS3(key, filename);
    }

    // GET SPECIFIC
    async getSpecific(specificName: string): Promise<Buffer> {
        /**
         * Download and return the text or raw bytes of a file stored in the S3 specifics path.
         */

        if (!this.specificPath) {
            throw new Error("Specific path not configured");
        }
        const stream = await this.getS3Object(`${this.specificPath}/${specificName}`);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    // GET SPECIFIC URL
    getSpecificUrl(specificName: string): string {
        /**
         * Get the full S3 URL for a specific file.
         */

        if (!this.specificPath) {
            throw new Error("Specific path not configured");
        }
        const key = `${this.specificPath}/${specificName}`.replace(/\\/g, "/");
        return `https://${this.bucketName}.s3.${this.awsRegionName}.amazonaws.com/${key}`;
    }

    // DOWNLOAD SPECIFIC TO FILE
    async downloadSpecificToFile(specificName: string, filename: string): Promise<void> {
        /**
         * Download and save a specific file from the S3 specific path to a local file.
         */

        if (!this.specificPath) {
            throw new Error("Specific path not configured");
        }
        await this.downloadFileFromS3(`${this.specificPath}/${specificName}`, filename);
    }

    // GET OBJECT
    async getObject(objectName: string): Promise<Buffer> {
        /**
         * Download and return the raw bytes of an object from the S3 objects path.
         */

        const stream = await this.getS3Object(`${this.objectsPath}/${objectName}`);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    // GET OBJECT URL
    getObjectUrl(objectName: string): string {
        /**
         * Get the full S3 URL for an object file (stored as JSON.gz).
         */

        const key = `${this.objectsPath}/${objectName}.json.gz`.replace(/\\/g, "/");
        return `https://${this.bucketName}.s3.${this.awsRegionName}.amazonaws.com/${key}`;
    }

    // GET DATA
    async getData(dataName: string): Promise<Buffer> {
        /**
         * Download and return the raw bytes of a data file from the S3 data path.
         */

        const stream = await this.getS3Object(`${this.dataPath}/${dataName}`);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    // GET DATA URL
    getDataUrl(dataName: string): string {
        /**
         * Get the full S3 URL for a data file (stored as JSON.gz).
         */

        const key = `${this.dataPath}/${dataName}.json.gz`.replace(/\\/g, "/");
        return `https://${this.bucketName}.s3.${this.awsRegionName}.amazonaws.com/${key}`;
    }

    // PUT TO S3
    async putToS3(key: string, body: Buffer | Uint8Array | string): Promise<void> {
        /**
         * Put an object to S3 with the specified key and body.
         */

        const client = this._getS3Client();
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: body,
        });
        await client.send(command);
    }

    // UPLOAD TO S3
    async uploadToS3(key: string, filename: string): Promise<void> {
        /**
         * Upload a file to S3 with the specified key.
         */

        const fileContent = await fs.readFile(filename);
        await this.putToS3(key, fileContent);
    }

    // SERIALIZE AND UPLOAD TO S3
    private async _serializeAndUploadToS3(
        s3Path: string,
        name: string,
        obj: unknown,
    ): Promise<void> {
        /**
         * Serialize an object to JSON, compress it with gzip, and upload it to S3.
         */

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aws-access-"));
        const tempName = path.join(tempDir, `${name}.json.gz`);

        try {
            const jsonString = JSON.stringify(obj);
            const compressed = await gzip(Buffer.from(jsonString, "utf-8"));
            await fs.writeFile(tempName, compressed);
            await this.uploadToS3(`${s3Path}/${name}.json.gz`, tempName);
        } finally {
            await fs.unlink(tempName).catch(() => {});
            await fs.rmdir(tempDir).catch(() => {});
        }
    }

    // SAVE MEDIA
    async saveMedia(name: string, mediaType: string, obj: Buffer | Uint8Array | string): Promise<void> {
        /**
         * Save a raw media object to S3.
         */

        const key = path.join(this.mediaPath, `${name}.${mediaType}`).replace(/\\/g, "/");
        await this.putToS3(key, obj);
    }

    // SAVE MEDIA FROM FILE
    async saveMediaFromFile(name: string, mediaType: string, filename: string): Promise<void> {
        /**
         * Save a media file to S3.
         */

        const key = path.join(this.mediaPath, `${name}.${mediaType}`).replace(/\\/g, "/");
        await this.uploadToS3(key, filename);
    }

    // SAVE SPECIFIC
    async saveSpecific(name: string, obj: Buffer | Uint8Array | string): Promise<void> {
        /**
         * Save a raw specific object to S3.
         */

        if (!this.specificPath) {
            throw new Error("Specific path not configured");
        }
        const key = path.join(this.specificPath, name).replace(/\\/g, "/");
        await this.putToS3(key, obj);
    }

    // UPLOAD SPECIFIC FROM FILE
    async uploadSpecificFromFile(name: string, filename: string): Promise<void> {
        /**
         * Upload a specific file to S3.
         */

        if (!this.specificPath) {
            throw new Error("Specific path not configured");
        }
        const key = path.join(this.specificPath, name).replace(/\\/g, "/");
        await this.uploadToS3(key, filename);
    }

    // SAVE OBJECT
    async saveObject(objectName: string, obj: unknown): Promise<void> {
        /**
         * Serialize an object using JSON, compress it with gzip, and upload it to S3 in the objects path.
         */

        await this._serializeAndUploadToS3(this.objectsPath, objectName, obj);
    }

    // SAVE OBJECT FROM FILE DELEGATE
    async saveObjectFromFileDelegate(
        objectName: string,
        delegate: (filename: string) => Promise<void> | void,
        filetype: string = "t",
    ): Promise<void> {
        /**
         * Save an object to S3 by executing a delegate function that writes to a temporary file, then uploading that file.
         */

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aws-access-"));
        const tempName = path.join(tempDir, objectName);

        try {
            await delegate(tempName);
            await this.uploadToS3(`${this.objectsPath}/${objectName}`, tempName);
        } finally {
            await fs.unlink(tempName).catch(() => {});
            await fs.rmdir(tempDir).catch(() => {});
        }
    }

    // SAVE OBJECT FROM DIRECTORY DELEGATE
    async saveObjectFromDirectoryDelegate(
        objectName: string,
        delegate: (directory: string) => Promise<void> | void,
    ): Promise<void> {
        /**
         * Save an object to S3 by executing a delegate function that writes to a temporary directory, then uploading all files from that directory.
         */

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aws-access-"));

        try {
            await delegate(tempDir);
            const files = await fs.readdir(tempDir);
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stat = await fs.stat(filePath);
                if (stat.isFile()) {
                    await this.uploadToS3(`${this.objectsPath}/${objectName}/${file}`, filePath);
                }
            }
        } finally {
            const files = await fs.readdir(tempDir);
            for (const file of files) {
                await fs.unlink(path.join(tempDir, file)).catch(() => {});
            }
            await fs.rmdir(tempDir).catch(() => {});
        }
    }

    // SAVE DATAFRAME
    async saveDataframe(dataframeName: string, dataframe: unknown): Promise<void> {
        /**
         * Serialize a dataframe-like object using JSON, compress it with gzip, and upload it to S3 in the data path.
         * Note: This uses JSON serialization. For pandas-like dataframes, consider using a specialized library.
         */

        await this._serializeAndUploadToS3(this.dataPath, dataframeName, dataframe);
    }

    // UPLOAD OBJECT FROM FILE
    async uploadObjectFromFile(objectName: string, filename: string): Promise<void> {
        /**
         * Upload an object to S3 from a file.
         */

        await this.uploadToS3(`${this.objectsPath}/${objectName}`, filename);
    }

    // CHECK ON S3
    private async _checkOnS3(key: string): Promise<boolean> {
        /**
         * Check if an object exists on S3.
         */

        try {
            const client = this._getS3Client();
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            await client.send(command);
            return true;
        } catch (error: unknown) {
            if (error && typeof error === "object" && "name" in error && error.name === "NotFound") {
                return false;
            }
            throw error;
        }
    }

    // REMOVE FROM S3
    private async _removeFromS3(key: string, ignoreIfNotExists: boolean): Promise<void> {
        /**
         * Remove an object from S3.
         */

        try {
            const client = this._getS3Client();
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            await client.send(command);
        } catch (error: unknown) {
            if (!ignoreIfNotExists) {
                throw error;
            }
        }
    }

    // REMOVE MEDIA
    async removeMedia(name: string, mediaType: string, ignoreIfNotExists: boolean = true): Promise<void> {
        /**
         * Remove a media file from S3 in the media path.
         */

        const key = path.join(this.mediaPath, `${name}.${mediaType}`).replace(/\\/g, "/");
        await this._removeFromS3(key, ignoreIfNotExists);
    }

    // REMOVE OBJECT
    async removeObject(objectName: string, ignoreIfNotExists: boolean = true): Promise<void> {
        /**
         * Remove an object from S3 in the objects path.
         */

        await this._removeFromS3(`${this.objectsPath}/${objectName}.json.gz`, ignoreIfNotExists);
    }

    // DOWNLOAD FILE FROM S3
    async downloadFileFromS3(key: string, filename: string): Promise<void> {
        /**
         * Download a file from S3 to a local file path.
         */

        const stream = await this.getS3Object(key);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        await fs.writeFile(filename, buffer);
    }

    // DOWNLOAD DIRECTORY FROM S3
    async downloadDirectoryFromS3(prefix: string, directory: string): Promise<void> {
        /**
         * Download a directory from S3 by listing all objects with the prefix and downloading each one.
         */

        const client = this._getS3Client();
        let continuationToken: string | undefined;

        while (true) {
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            });

            const result = await client.send(command);

            if (result.Contents) {
                for (const obj of result.Contents) {
                    if (obj.Key) {
                        const relativePath = path.relative(prefix, obj.Key);
                        const localFilePath = path.join(directory, relativePath);
                        const localDir = path.dirname(localFilePath);
                        await fs.mkdir(localDir, {recursive: true});
                        await this.downloadFileFromS3(obj.Key, localFilePath);
                    }
                }
            }

            if (result.IsTruncated && result.NextContinuationToken) {
                continuationToken = result.NextContinuationToken;
            } else {
                break;
            }
        }
    }

    // DOWNLOAD FROM S3 AND DESERIALIZE
    private async _downloadFromS3AndDeserialize(s3Path: string, name: string): Promise<unknown> {
        /**
         * Download a JSON-serialized and gzipped object from S3 and deserialize it.
         */

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aws-access-"));
        const tempName = path.join(tempDir, `${name}.json.gz`);

        try {
            await this.downloadFileFromS3(`${s3Path}/${name}.json.gz`, tempName);
            const compressed = await fs.readFile(tempName);
            const decompressed = await gunzip(compressed);
            const jsonString = decompressed.toString("utf-8");
            return JSON.parse(jsonString);
        } finally {
            await fs.unlink(tempName).catch(() => {});
            await fs.rmdir(tempDir).catch(() => {});
        }
    }

    // LOAD OBJECT
    async loadObject(objectName: string): Promise<unknown> {
        /**
         * Download a gzipped JSON-serialized object from S3 in the objects path, decompress it, and deserialize it.
         */

        return this._downloadFromS3AndDeserialize(this.objectsPath, objectName);
    }

    // LOAD OBJECT FROM FILE DELEGATE
    async loadObjectFromFileDelegate<T>(
        objectName: string,
        delegate: (filename: string) => Promise<T> | T,
        fileType: string = "t",
    ): Promise<T> {
        /**
         * Load an object from S3 by downloading it to a temporary file and executing a delegate function that reads from that file.
         */

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aws-access-"));
        const tempName = path.join(tempDir, objectName);

        try {
            await this.downloadFileFromS3(`${this.objectsPath}/${objectName}`, tempName);
            return await delegate(tempName);
        } finally {
            await fs.unlink(tempName).catch(() => {});
            await fs.rmdir(tempDir).catch(() => {});
        }
    }

    // LOAD OBJECT FROM DIRECTORY DELEGATE
    async loadObjectFromDirectoryDelegate<T>(
        modelName: string,
        delegate: (directory: string) => Promise<T> | T,
    ): Promise<T> {
        /**
         * Load an object from S3 by downloading a directory structure to a temporary directory and executing a delegate function that reads from it.
         */

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "aws-access-"));

        try {
            await this.downloadDirectoryFromS3(`${this.objectsPath}/${modelName}`, tempDir);
            return await delegate(tempDir);
        } finally {
            const files = await fs.readdir(tempDir);
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stat = await fs.stat(filePath);
                if (stat.isDirectory()) {
                    await fs.rmdir(filePath, {recursive: true}).catch(() => {});
                } else {
                    await fs.unlink(filePath).catch(() => {});
                }
            }
            await fs.rmdir(tempDir).catch(() => {});
        }
    }

    // LOAD DATAFRAME
    async loadDataframe(dataframeName: string): Promise<unknown> {
        /**
         * Download a gzipped JSON-serialized DataFrame from S3 in the data path, decompress it, and deserialize it.
         * Note: This uses JSON deserialization. For pandas-like dataframes, consider using a specialized library.
         */

        return this._downloadFromS3AndDeserialize(this.dataPath, dataframeName);
    }

    // CHECK FOR OBJECT
    async checkForObject(objectName: string): Promise<boolean> {
        /**
         * Check if an object exists on S3 in the objects path.
         */

        return this._checkOnS3(`${this.objectsPath}/${objectName}.json.gz`);
    }

    // GET PARAMETER VALUE
    async getParameterValue(parameterName: string, withDecryption: boolean = false): Promise<string> {
        /**
         * Get a parameter value from AWS Systems Manager Parameter Store.
         */

        const client = this._getSSMClient();
        const command = new GetParameterCommand({
            Name: parameterName,
            WithDecryption: withDecryption,
        });
        const response = await client.send(command);
        return response.Parameter?.Value || "";
    }

    // SEND NOTIFICATION
    async sendNotification(message: string, subject?: string, topic?: string): Promise<void> {
        /**
         * Send a notification via AWS SNS.
         */

        const topicArn = `arn:aws:sns:${this.awsRegionName}:${this.awsAccountId}:${topic || this.snsAlertTopic}`;
        const finalSubject = subject || topic || this.snsAlertTopic || "Notification";

        const client = this._getSNSClient();
        const command = new PublishCommand({
            TopicArn: topicArn,
            Message: message,
            Subject: finalSubject,
        });
        await client.send(command);
    }
}
