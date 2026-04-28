// STRIP MARKDOWN
export function stripMarkdown(markdown: string): string {
    /**
     * Strips markdown syntax from a string to produce plain text suitable for
     * speech synthesis. Removes headers, emphasis, links, code blocks, list
     * markers and table rows, and collapses runs of blank lines.
     */

    return markdown
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .replace(/\|.*\|/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
