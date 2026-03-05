// NATIVE TEXT TO SPEECH CLIENT
/**
 * Client-side helper for text-to-speech using the browser's built-in
 * Web Speech API (SpeechSynthesis). Provides the same public interface as
 * the ElevenLabs module so the two can be swapped transparently.
 * Free, offline-capable, and zero-latency on iOS and Android.
 */

import type {PlayTextAsSpeechOptions} from "./elevenlabsTextToSpeech";

// PREFERRED VOICE PATTERNS
/**
 * Ordered list of regex patterns used to select the best available voice.
 * Siri British male first, then Siri British female, then other Siri voices,
 * then high-quality named voices (Daniel = British male, Martha = British female),
 * and finally any English voice as a last resort.
 */

const PREFERRED_VOICE_PATTERNS: RegExp[] = [
    /Siri.*Male.*British/i,
    /Daniel/i,
    /Siri.*Female.*British/i,
    /Siri.*British/i,
    /Siri.*Male/i,
    /Siri.*Female/i,
    /Siri/i,
    /Martha/i,
];

// CACHED VOICE
/**
 * Caches the selected voice so the (potentially slow) lookup only
 * runs once. Reset to undefined so null means "looked up but nothing found".
 */

let cachedVoice: SpeechSynthesisVoice | null | undefined = undefined;

// ENSURE VOICES LOADED
function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
    /**
     * Returns the available voices, waiting for the asynchronous voiceschanged
     * event if the list is not yet populated (common on Android Chrome).
     * Resolves immediately when voices are already available.
     */

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) return Promise.resolve(voices);

    return new Promise((resolve) => {
        const onVoicesChanged = () => {
            window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
            resolve(window.speechSynthesis.getVoices());
        };
        window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);

        // safety timeout so we never hang indefinitely
        setTimeout(() => {
            window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
            resolve(window.speechSynthesis.getVoices());
        }, 2_000);
    });
}

// PICK BEST VOICE
async function pickBestVoice(): Promise<SpeechSynthesisVoice | null> {
    /**
     * Walks the preferred-voice list and returns the first match from the
     * device's installed voices. Falls back to any en-GB voice, then any
     * English voice, then null (which lets the browser use its default).
     */

    if (cachedVoice !== undefined) return cachedVoice;

    const voices = await ensureVoicesLoaded();

    // try each preferred pattern in priority order
    for (const pattern of PREFERRED_VOICE_PATTERNS) {
        const match = voices.find(v => pattern.test(v.name) && v.lang.startsWith("en"));
        if (match) {
            cachedVoice = match;
            return match;
        }
    }

    // fall back to any en-GB voice, then any English voice
    const fallback = voices.find(v => v.lang === "en-GB")
        ?? voices.find(v => v.lang.startsWith("en"))
        ?? null;
    cachedVoice = fallback;
    return fallback;
}

// PLAYBACK STATE
/**
 * Tracks the current utterance and its associated text so callers
 * can query what is playing and toggle playback on/off.
 */

let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentText: string | null = null;
let isPlaying: boolean = false;

// iOS long-utterance keepalive handle
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

// STOP CURRENT AUDIO
export function stopCurrentAudio(): void {
    /**
     * Cancels any in-progress native speech and resets state.
     */

    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
    }
    window.speechSynthesis.cancel();
    currentUtterance = null;
    currentText = null;
    isPlaying = false;
}

// GET CURRENT PLAYING TEXT
export function getCurrentPlayingText(): string | null {
    /**
     * Returns the text currently being spoken, or null if silent.
     */

    return isPlaying ? currentText : null;
}

// PLAY TEXT AS SPEECH
export async function playTextAsSpeech(
    text: string,
    options: PlayTextAsSpeechOptions = {},
): Promise<{success: boolean; stopped?: boolean; error?: string}> {
    /**
     * Speaks the given text using the device's native TTS engine.
     * Toggles off if the same text is already playing.
     * Includes an iOS workaround that periodically pauses/resumes
     * to prevent Safari from silently killing long utterances.
     */

    // toggle off if the same text is already playing
    if (currentText === text && isPlaying) {
        stopCurrentAudio();
        options.onEnded?.();
        return {success: true, stopped: true};
    }

    // stop any previous speech before starting new
    stopCurrentAudio();

    if (!window.speechSynthesis) {
        return {success: false, error: "Native speech synthesis not available in this browser"};
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";

    // select the best available voice (Siri British male preferred)
    const voice = await pickBestVoice();
    if (voice) {
        utterance.voice = voice;
    }

    currentUtterance = utterance;
    currentText = text;
    isPlaying = true;

    const {onEnded} = options;

    utterance.onend = () => {
        if (currentUtterance === utterance) {
            if (keepAliveTimer) {
                clearInterval(keepAliveTimer);
                keepAliveTimer = null;
            }
            currentUtterance = null;
            currentText = null;
            isPlaying = false;
            onEnded?.();
        }
    };

    utterance.onerror = (event) => {
        if (event.error === "canceled") return;
        if (currentUtterance === utterance) {
            if (keepAliveTimer) {
                clearInterval(keepAliveTimer);
                keepAliveTimer = null;
            }
            currentUtterance = null;
            currentText = null;
            isPlaying = false;
            onEnded?.();
        }
    };

    window.speechSynthesis.speak(utterance);

    // ios workaround: Safari silently stops long utterances (~15 s).
    // Periodically pausing and resuming keeps the synthesis alive.
    keepAliveTimer = setInterval(() => {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
        } else {
            clearInterval(keepAliveTimer!);
            keepAliveTimer = null;
        }
    }, 10_000);

    return {success: true};
}
