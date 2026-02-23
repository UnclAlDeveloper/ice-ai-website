"use client";

import {useState, useTransition, useRef, useEffect} from "react";
import {
    Stack,
    Typography,
    TextField,
    Button,
    LinearProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Tabs,
    Tab,
    Paper,
} from "@mui/material";
import {
    prepareVideoFile,
    convertVideoToMp4,
    extractAudioToMp3,
    uploadFinalFilesToS3,
    transcribeAudio,
    getVideoUrl,
    saveVideo,
    type VideoDefinition,
} from "./actions";

// TYPES
interface Language {
    code: string;
    language: string;
}

interface VideoStage {
    code: string;
    name: string;
    description: string | null;
}

interface AddVideoClientProps {
    languages: Language[];
    stages: VideoStage[];
    userId: string;
}

// PROCESSING STEPS
const STEP_PREPARING = "Preparing video file...";
const STEP_CONVERTING_MP4 = "Converting to MP4...";
const STEP_CONVERTING_MP3 = "Extracting audio...";
const STEP_UPLOADING = "Uploading to S3...";
const STEP_TRANSCRIBING = "Creating transcript...";
const STEP_SAVING = "Saving video...";

// HELPERS
const sanitizeName = (raw: string): string => raw.replace(/[^A-Za-z0-9_-]/g, "");

const getExtensionFromFilename = (filename: string): string => {
    const match = filename.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : "mp4";
};

// ADD VIDEO CLIENT
export default function AddVideoClient({languages, stages, userId}: AddVideoClientProps) {
    /**
     * Client component for adding new videos to the Anna Trainer system.
     * Handles file selection, upload, conversion, transcription, and saving.
     */

    // form state
    const [name, setName] = useState("");
    const [languageCode, setLanguageCode] = useState("--");
    const [selectedTab, setSelectedTab] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedUrl, setSelectedUrl] = useState("");

    // processing state
    const [isPending, startTransition] = useTransition();
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // video definition state
    const [showDefinition, setShowDefinition] = useState(false);
    const [videoDefinition, setVideoDefinition] = useState<VideoDefinition>({
        name: "",
        languageCode: "--",
        stageCode: "RAW",
        videoUrl: "",
        transcript: "",
        description: "",
    });

    // refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const originalExtensionRef = useRef<string>("mp4");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // create preview URL when file is selected
    useEffect(() => {
        /**
         * Creates an object URL for video preview when a file is selected.
         * Cleans up the URL when the component unmounts or file changes.
         */

        if (selectedFile) {
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);

            return () => {
                URL.revokeObjectURL(url);
                setPreviewUrl(null);
            };
        } else {
            setPreviewUrl(null);
        }
    }, [selectedFile]);

    // HANDLE FILE SELECT
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        /**
         * Handles file selection from the file input.
         * Sets the file and auto-populates the name field if empty.
         */

        const file = event.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        setSelectedUrl("");
        setError(null);

        originalExtensionRef.current = getExtensionFromFilename(file.name);

        // auto-populate name if empty
        if (!name.trim()) {
            const baseName = file.name.replace(/\.[^./\\]+$/, "");
            if (baseName) setName(baseName);
        }
    };

    // HANDLE URL CHANGE
    const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        /**
         * Handles URL input changes.
         * Clears file selection and auto-populates name if empty.
         */

        const url = event.target.value;
        setSelectedUrl(url);
        setSelectedFile(null);
        setError(null);

        // auto-populate name from URL if empty
        if (!name.trim() && url) {
            try {
                const urlObj = new URL(url);
                const parts = urlObj.pathname.split("/").filter(Boolean);
                const lastPart = parts.length ? parts[parts.length - 1] : "";
                const baseName = lastPart.replace(/\.[^./\\]+$/, "");
                if (baseName) setName(baseName);
            } catch {
                // ignore url parse errors
            }
        }
    };

    // HANDLE ADD
    const handleAdd = async () => {
        /**
         * Processes the selected video: uploads, converts, transcribes, and prepares the definition.
         */

        if (!name.trim()) {
            setError("Please enter a name for the video");
            return;
        }

        if (!selectedFile && !selectedUrl) {
            setError("Please select a file or enter a URL");
            return;
        }

        setError(null);
        setIsProcessing(true);

        startTransition(async () => {
            try {
                // step 1: prepare video file
                setStatus(STEP_PREPARING);
                setProgress(0.1);

                let prepareResult;
                if (selectedFile) {
                    // use API route with FormData for file uploads (handles large files without JSON serialization)
                    const formData = new FormData();
                    formData.append("file", selectedFile);
                    const videoName = name.trim() || selectedFile.name.replace(/\.[^/.]+$/, "");
                    formData.append("name", videoName);
                    
                    const response = await fetch("/api/anna-trainer/prepare-video", {
                        method: "POST",
                        body: formData,
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({error: "Request failed"}));
                        throw new Error(errorData.error || `HTTP ${response.status}`);
                    }
                    
                    prepareResult = await response.json();
                } else {
                    // use regular object for URL (server action works fine for URLs)
                    const source = {type: "url" as const, url: selectedUrl};
                    prepareResult = await prepareVideoFile(source, name);
                }
                if (!prepareResult.success || !prepareResult.sanitizedName || !prepareResult.tempDir) {
                    throw new Error(prepareResult.error || "File preparation failed");
                }

                setProgress(0.2);

                // step 2: convert to MP4
                setStatus(STEP_CONVERTING_MP4);
                setProgress(0.3);

                const mp4Result = await convertVideoToMp4(
                    prepareResult.sanitizedName,
                    prepareResult.originalExtension || "mp4",
                    prepareResult.tempDir,
                );
                if (!mp4Result.success || !mp4Result.mp4Filename) {
                    throw new Error(mp4Result.error || "MP4 conversion failed");
                }

                setProgress(0.5);

                // step 3: extract audio to MP3
                setStatus(STEP_CONVERTING_MP3);
                setProgress(0.6);

                const mp3Result = await extractAudioToMp3(prepareResult.sanitizedName, prepareResult.tempDir);
                if (!mp3Result.success || !mp3Result.mp3Filename) {
                    throw new Error(mp3Result.error || "MP3 extraction failed");
                }

                setProgress(0.7);

                // step 4: upload final files to S3
                setStatus(STEP_UPLOADING);
                setProgress(0.8);

                const uploadResult = await uploadFinalFilesToS3(
                    prepareResult.sanitizedName,
                    prepareResult.tempDir,
                    mp4Result.mp4Filename,
                    mp3Result.mp3Filename,
                );
                if (!uploadResult.success || !uploadResult.mp4Filename || !uploadResult.mp3Filename) {
                    throw new Error(uploadResult.error || "Upload failed");
                }

                setProgress(0.9);

                // step 5: transcribe audio
                setStatus(STEP_TRANSCRIBING);
                setProgress(0.92);

                let transcript = "";
                let detectedLanguage = languageCode;

                const transcribeResult = await transcribeAudio(uploadResult.mp3Filename, languageCode);
                if (transcribeResult.success) {
                    transcript = transcribeResult.transcript;
                    if (transcribeResult.detectedLanguage) {
                        detectedLanguage = transcribeResult.detectedLanguage;
                    }
                }
                // transcription failure is non-fatal

                setProgress(0.9);

                // prepare video definition
                const videoUrl = await getVideoUrl(uploadResult.mp4Filename);

                setVideoDefinition({
                    name,
                    languageCode: detectedLanguage,
                    stageCode: "RAW",
                    videoUrl,
                    transcript,
                    description: "",
                });

                setShowDefinition(true);
                setStatus(null);
                setProgress(null);

                // reset file selection
                setSelectedFile(null);
                setSelectedUrl("");
                setPreviewUrl(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Processing failed");
                setStatus(null);
                setProgress(null);
            } finally {
                setIsProcessing(false);
            }
        });
    };

    // HANDLE SAVE
    const handleSave = async () => {
        /**
         * Saves the video definition to the database.
         */

        if (!videoDefinition.name) {
            setError("Video name is required");
            return;
        }

        if (videoDefinition.languageCode === "--") {
            setError("Please select a language");
            return;
        }

        setError(null);

        startTransition(async () => {
            try {
                setStatus(STEP_SAVING);
                await saveVideo(videoDefinition);
                setStatus(null);

                // reset form
                handleNew();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to save video");
                setStatus(null);
            }
        });
    };

    // HANDLE NEW
    const handleNew = () => {
        /**
         * Resets the form to initial state for adding a new video.
         */

        setName("");
        setLanguageCode("--");
        setSelectedFile(null);
        setSelectedUrl("");
        setPreviewUrl(null);
        setShowDefinition(false);
        setStatus(null);
        setProgress(null);
        setError(null);
        setVideoDefinition({
            name: "",
            languageCode: "--",
            stageCode: "RAW",
            videoUrl: "",
            transcript: "",
            description: "",
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const hasSelection = !!(selectedFile || selectedUrl.trim());

    return (
        <Stack spacing={2} sx={{mt: {xs: 2, sm: 3}, width: "100%", maxWidth: 640}}>
            <Typography variant="h5" component="h2" gutterBottom sx={{color: "primary.main"}}>
                Translate and Dub Videos
            </Typography>

            {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Name and Language */}
            <Stack direction="row" spacing={2} alignItems="flex-start">
                <TextField
                    label="Name"
                    placeholder="Enter a name for this video"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isProcessing}
                    sx={{flexGrow: 1}}
                />
                <FormControl sx={{width: 120}}>
                    <InputLabel id="language-select-label">Language</InputLabel>
                    <Select
                        labelId="language-select-label"
                        value={languageCode}
                        label="Language"
                        onChange={(e) => setLanguageCode(e.target.value)}
                        disabled={isProcessing}
                    >
                        <MenuItem value="--">Auto</MenuItem>
                        {languages.map((lang) => (
                            <MenuItem key={lang.code} value={lang.code}>
                                {lang.code.toUpperCase()}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Stack>

            {/* Video Source Selection */}
            <Paper variant="outlined" sx={{p: 2}}>
                <Tabs
                    value={selectedTab}
                    onChange={(_, newValue) => setSelectedTab(newValue)}
                    sx={{mb: 2}}
                >
                    <Tab label="Upload File" disabled={isProcessing} />
                    <Tab label="From URL" disabled={isProcessing} />
                </Tabs>

                {selectedTab === 0 && (
                    <Box>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/*"
                            onChange={handleFileSelect}
                            disabled={isProcessing}
                            style={{display: "none"}}
                            id="video-file-input"
                        />
                        <label htmlFor="video-file-input">
                            <Button
                                variant="outlined"
                                component="span"
                                disabled={isProcessing}
                            >
                                Choose Video File
                            </Button>
                        </label>
                        {selectedFile && previewUrl && (
                            <Box sx={{mt: 2}}>
                                <video
                                    src={previewUrl}
                                    controls
                                    style={{
                                        width: "100%",
                                        maxWidth: "100%",
                                        maxHeight: "400px",
                                        borderRadius: "4px",
                                    }}
                                >
                                    Your browser does not support the video tag.
                                </video>
                                <Typography variant="caption" sx={{mt: 0.5, color: "text.secondary", display: "block"}}>
                                    {selectedFile.name}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}

                {selectedTab === 1 && (
                    <TextField
                        fullWidth
                        label="Video URL"
                        placeholder="https://example.com/video.mp4"
                        value={selectedUrl}
                        onChange={handleUrlChange}
                        disabled={isProcessing}
                    />
                )}
            </Paper>

            {/* Action Buttons */}
            <Stack direction="row" spacing={1}>
                <Button
                    variant="contained"
                    disabled={!name.trim() || !hasSelection || isProcessing || isPending}
                    onClick={handleAdd}
                >
                    {isProcessing ? "Processing..." : "Add"}
                </Button>
                <Button
                    variant="outlined"
                    disabled={!showDefinition || isProcessing || isPending}
                    onClick={handleSave}
                >
                    {isPending && status === STEP_SAVING ? "Saving..." : "Save"}
                </Button>
                <Button variant="outlined" onClick={handleNew} disabled={isProcessing}>
                    New
                </Button>
            </Stack>

            {/* Progress */}
            {status && (
                <Stack spacing={1}>
                    <Typography variant="body2" color="secondary.main">
                        {status}
                    </Typography>
                    {progress !== null && (
                        <LinearProgress variant="determinate" value={progress * 100} />
                    )}
                </Stack>
            )}

            {/* Video Definition Editor */}
            {showDefinition && (
                <Paper variant="outlined" sx={{p: 2}}>
                    <Typography variant="h6" gutterBottom>
                        Video Definition
                    </Typography>

                    <Stack spacing={2}>
                        <TextField
                            label="Name"
                            value={videoDefinition.name}
                            onChange={(e) =>
                                setVideoDefinition((prev) => ({...prev, name: e.target.value}))
                            }
                            disabled={isProcessing}
                        />

                        <Stack direction="row" spacing={2}>
                            <FormControl sx={{minWidth: 120}}>
                                <InputLabel id="def-language-label">Language</InputLabel>
                                <Select
                                    labelId="def-language-label"
                                    value={videoDefinition.languageCode}
                                    label="Language"
                                    onChange={(e) =>
                                        setVideoDefinition((prev) => ({
                                            ...prev,
                                            languageCode: e.target.value,
                                        }))
                                    }
                                    disabled={isProcessing}
                                >
                                    <MenuItem value="--">Select...</MenuItem>
                                    {languages.map((lang) => (
                                        <MenuItem key={lang.code} value={lang.code}>
                                            {lang.language}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl sx={{minWidth: 120}}>
                                <InputLabel id="def-stage-label">Stage</InputLabel>
                                <Select
                                    labelId="def-stage-label"
                                    value={videoDefinition.stageCode}
                                    label="Stage"
                                    onChange={(e) =>
                                        setVideoDefinition((prev) => ({
                                            ...prev,
                                            stageCode: e.target.value,
                                        }))
                                    }
                                    disabled={isProcessing}
                                >
                                    {stages.map((stage) => (
                                        <MenuItem key={stage.code} value={stage.code}>
                                            {stage.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>

                        <TextField
                            label="Video URL"
                            value={videoDefinition.videoUrl}
                            onChange={(e) =>
                                setVideoDefinition((prev) => ({...prev, videoUrl: e.target.value}))
                            }
                            disabled={isProcessing}
                        />

                        <TextField
                            label="Transcript"
                            value={videoDefinition.transcript}
                            onChange={(e) =>
                                setVideoDefinition((prev) => ({...prev, transcript: e.target.value}))
                            }
                            multiline
                            rows={4}
                            disabled={isProcessing}
                        />

                        <TextField
                            label="Description"
                            value={videoDefinition.description}
                            onChange={(e) =>
                                setVideoDefinition((prev) => ({...prev, description: e.target.value}))
                            }
                            multiline
                            rows={2}
                            disabled={isProcessing}
                        />
                    </Stack>
                </Paper>
            )}
        </Stack>
    );
}
