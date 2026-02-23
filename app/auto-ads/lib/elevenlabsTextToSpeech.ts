// ELEVENLABS TEXT TO SPEECH CLIENT
/**
 * Client-side helper for converting text to speech using the ElevenLabs API.
 * Uses the Web Audio API for reliable cross-platform playback including iOS.
 * Requires the following environment variables (with NEXT_PUBLIC_ prefix for client access):
 * - NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_API_KEY
 * - NEXT_PUBLIC_ELEVENLABS_TEXT2SPEECH_MODEL_NAME
 * - NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_VOICE_ID
 */

// AUDIO CONTEXT
/**
 * Shared AudioContext instance for Web Audio API playback.
 * Created lazily on first use to comply with browser autoplay policies.
 */

let audioContext: AudioContext | null = null;

// AUDIO PLAYBACK STATE
/**
 * Tracks the currently playing audio source and its associated text,
 * allowing for toggle behavior and stopping previous audio.
 */

let currentSource: AudioBufferSourceNode | null = null;
let currentText: string | null = null;
let isPlaying: boolean = false;
let cancelled: boolean = false;

// GET OR CREATE AUDIO CONTEXT
function getAudioContext(): AudioContext {
    /**
     * Returns the shared AudioContext, creating it if necessary.
     * Also resumes the context if it's in a suspended state (required for iOS).
     */

    if (!audioContext) {
        audioContext = new AudioContext();
    }
    return audioContext;
}

// STOP CURRENT AUDIO
export function stopCurrentAudio(): void {
    /**
     * Stops any currently playing audio and cleans up resources.
     * Also cancels any in-flight request so a second tap stops before playback starts.
     */

    cancelled = true;
    if (currentSource) {
        try {
            currentSource.stop();
        } catch {
            // ignore errors if already stopped
        }
        currentSource.disconnect();
        currentSource = null;
    }
    currentText = null;
    isPlaying = false;
}

// GET CURRENT PLAYING TEXT
export function getCurrentPlayingText(): string | null {
    /**
     * Returns the text currently being spoken, or null if nothing is playing.
     */

    return isPlaying ? currentText : null;
}

// ELEVENLABS TEXT TO SPEECH RESPONSE
interface ElevenLabsTextToSpeechResponse {
    success: boolean;
    audioBlob?: Blob;
    audioBuffer?: ArrayBuffer;
    error?: string;
}

// ELEVENLABS TEXT TO SPEECH OPTIONS
interface ElevenLabsTextToSpeechOptions {
    outputFormat?: string;
}

// CONVERT TEXT TO SPEECH
export async function convertTextToSpeech(
    text: string,
    options: ElevenLabsTextToSpeechOptions = {},
): Promise<ElevenLabsTextToSpeechResponse> {
    /**
     * Converts the provided text to speech using the ElevenLabs API.
     * Returns an audio ArrayBuffer that can be decoded by the Web Audio API.
     */

    const apiKey = process.env.NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_API_KEY;
    const modelId = process.env.NEXT_PUBLIC_ELEVENLABS_TEXT2SPEECH_MODEL_NAME;
    const voiceId = process.env.NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_VOICE_ID;

    // validate environment variables are set
    if (!apiKey) {
        return {
            success: false,
            error: "ElevenLabs API key not configured (NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_API_KEY)",
        };
    }

    if (!modelId) {
        return {
            success: false,
            error: "ElevenLabs model name not configured (NEXT_PUBLIC_ELEVENLABS_TEXT2SPEECH_MODEL_NAME)",
        };
    }

    if (!voiceId) {
        return {
            success: false,
            error: "ElevenLabs voice ID not configured (NEXT_PUBLIC_AUTO_ADS_ELEVENLABS_VOICE_ID)",
        };
    }

    // validate text is provided
    if (!text || text.trim().length === 0) {
        return {
            success: false,
            error: "No text provided for conversion",
        };
    }

    const {outputFormat = "mp3_44100_128"} = options;

    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "xi-api-key": apiKey,
                },
                body: JSON.stringify({
                    text: text,
                    model_id: modelId,
                }),
            },
        );

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                error: `ElevenLabs API error (${response.status}): ${errorText}`,
            };
        }

        // get the audio as an ArrayBuffer for Web Audio API
        const audioBuffer = await response.arrayBuffer();

        return {
            success: true,
            audioBuffer,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to convert text to speech",
        };
    }
}

// PLAY TEXT AS SPEECH OPTIONS
export interface PlayTextAsSpeechOptions {
    onEnded?: () => void;
}

// PLAY TEXT AS SPEECH
export async function playTextAsSpeech(
    text: string,
    options: PlayTextAsSpeechOptions = {},
): Promise<{success: boolean; stopped?: boolean; error?: string}> {
    /**
     * Converts text to speech and plays it using the Web Audio API.
     * If the same text is already playing, it stops playback and returns stopped: true.
     * If different text is playing, it stops the previous audio first.
     * options.onEnded is called when playback finishes (natural end or stop).
     * Returns a promise that resolves when playback starts (not when it ends).
     *
     * Uses the Web Audio API for reliable cross-platform support including iOS.
     * The AudioContext is resumed on each call to handle iOS autoplay restrictions.
     */

    // if the same text is already playing or loading, toggle it off
    if (currentText === text && isPlaying) {
        stopCurrentAudio();
        return {success: true, stopped: true};
    }

    // stop any currently playing audio before starting new audio
    stopCurrentAudio();

    // mark this request as the active one so a second tap can cancel before playback starts
    currentText = text;
    isPlaying = true;
    cancelled = false;

    // get or create the audio context and resume it (required for iOS)
    // this must happen in response to a user gesture
    const ctx = getAudioContext();

    try {
        // resume the audio context if suspended (iOS requires this on user gesture)
        if (ctx.state === "suspended") {
            await ctx.resume();
        }
    } catch (error) {
        return {
            success: false,
            error: "Failed to initialize audio: " + (error instanceof Error ? error.message : String(error)),
        };
    }

    // fetch the audio from ElevenLabs
    const result = await convertTextToSpeech(text);

    if (cancelled) {
        currentText = null;
        isPlaying = false;
        return {success: true, stopped: true};
    }

    if (!result.success || !result.audioBuffer) {
        currentText = null;
        isPlaying = false;
        return {
            success: false,
            error: result.error || "Failed to generate audio",
        };
    }

    try {
        // decode the audio data
        const decodedAudio = await ctx.decodeAudioData(result.audioBuffer.slice(0));

        // create a buffer source node
        const source = ctx.createBufferSource();
        source.buffer = decodedAudio;
        source.connect(ctx.destination);

        // store references to current playback
        currentSource = source;
        currentText = text;
        isPlaying = true;

        // clean up when audio finishes playing and notify listener
        const {onEnded} = options;
        source.onended = () => {
            if (currentSource === source) {
                currentSource = null;
                currentText = null;
                isPlaying = false;
                onEnded?.();
            }
        };

        // start playback (skip if cancelled during decode)
        if (!cancelled) {
            source.start(0);
            return {success: true};
        }
        return {success: true, stopped: true};
    } catch (error) {
        if (!cancelled) {
            currentSource = null;
            currentText = null;
            isPlaying = false;
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to play audio",
        };
    }
}
