// TEXT TO SPEECH DISPATCHER
/**
 * Thin routing layer that picks the appropriate TTS back-end at runtime.
 * On mobile Apple/Android devices with native speech support it uses the
 * free Web Speech API; everywhere else it falls back to ElevenLabs.
 * Consumers import from this module and never need to know which engine
 * is in use.
 */

import type {PlayTextAsSpeechOptions} from "./elevenlabsTextToSpeech";
import * as elevenlabs from "./elevenlabsTextToSpeech";
import * as native from "./nativeTextToSpeech";

// IS MOBILE DEVICE
function isMobileDevice(): boolean {
    /**
     * Returns true when the user-agent indicates an iPhone, iPad, iPod, or
     * Android device. Checked once per call (cheap regex test).
     */

    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// IS NATIVE TTS AVAILABLE
function isNativeTtsAvailable(): boolean {
    /**
     * Returns true when the browser exposes the Web Speech API.
     */

    return typeof window !== "undefined" && "speechSynthesis" in window;
}

// USE NATIVE
function useNative(): boolean {
    /**
     * Decides whether to route through the native TTS engine.
     * Only returns true on mobile devices that actually support it.
     */

    return isMobileDevice() && isNativeTtsAvailable();
}

// PLAY TEXT AS SPEECH
export async function playTextAsSpeech(
    text: string,
    options: PlayTextAsSpeechOptions = {},
): Promise<{success: boolean; stopped?: boolean; error?: string}> {
    /**
     * Converts text to speech and plays it, delegating to the native engine
     * on mobile or ElevenLabs on desktop.
     */

    if (useNative()) {
        return native.playTextAsSpeech(text, options);
    }
    return elevenlabs.playTextAsSpeech(text, options);
}

// GET CURRENT PLAYING TEXT
export function getCurrentPlayingText(): string | null {
    /**
     * Returns the text currently being spoken from whichever engine is active,
     * or null if nothing is playing.
     */

    return native.getCurrentPlayingText() ?? elevenlabs.getCurrentPlayingText();
}

// STOP CURRENT AUDIO
export function stopCurrentAudio(): void {
    /**
     * Stops playback on both engines to guarantee silence regardless of which
     * one was last used.
     */

    native.stopCurrentAudio();
    elevenlabs.stopCurrentAudio();
}

export type {PlayTextAsSpeechOptions};
