export const UNTITLED_CONVERSATION = 'New conversation';

const MARKDOWN_PREFIX = /^(?:#{1,6}\s+|>\s+|[-*+]\s+|\d+[.)]\s+)+/;

/**
 * Builds a conversation title from the first user message: first meaningful
 * line, markdown noise removed, truncated on a word boundary.
 */
export function deriveTitle(input: string, maxLength = 48): string {
  const firstLine = input
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) return UNTITLED_CONVERSATION;

  const cleaned = firstLine
    .replace(MARKDOWN_PREFIX, '')
    .replace(/```.*$/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return UNTITLED_CONVERSATION;
  if (cleaned.length <= maxLength) return cleaned;

  const cut = cleaned.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  // Only break on a word boundary when it does not throw away most of the text.
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
