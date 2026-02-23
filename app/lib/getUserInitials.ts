// GET USER INITIALS
export function getUserInitials(name: string | undefined | null): string {
    /* Extracts initials from a user's name or email. Returns 1 letter for single names, 2 letters for multi-word names. Only uses alphanumeric characters (no punctuation). */

    if (!name) return '?';

    // Remove extra whitespace and split into words
    const words = name.trim().split(/\s+/).filter(word => word.length > 0);

    if (words.length === 0) return '?';

    // Helper function to get first alphanumeric character from a word
    const getFirstAlphanumeric = (word: string): string | null => {
        const match = word.match(/[a-zA-Z0-9]/);
        return match ? match[0].toUpperCase() : null;
    };

    // Single word: return first alphanumeric character
    if (words.length === 1) {
        const initial = getFirstAlphanumeric(words[0]);
        return initial || '?';
    }

    // Multiple words: return first alphanumeric character of first two words
    const first = getFirstAlphanumeric(words[0]);
    const second = getFirstAlphanumeric(words[1]);

    if (first && second) {
        return first + second;
    } else if (first) {
        return first;
    }

    return '?';
}
