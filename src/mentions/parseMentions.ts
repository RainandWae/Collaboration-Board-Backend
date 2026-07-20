const mentionEmailRegex = /@([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

export function parseMentionedEmails(text: string) {
    const emails = new Set<string>();

    for (const match of text.matchAll(mentionEmailRegex)) {
        emails.add(match[1].toLowerCase());
    }

    return [...emails];
}
