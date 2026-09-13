/** Helpers for the markdown renderer. */

/** Minimal structural view of a hast node — avoids depending on hast types. */
interface HastNodeLike {
  type?: string;
  tagName?: string;
  properties?: { className?: unknown };
  children?: HastNodeLike[];
}

/**
 * Reads the `language-xyz` class off the nested `<code>` element of a `<pre>`,
 * which is how fenced code blocks declare their language.
 */
export function extractLanguage(node: unknown): string | undefined {
  const pre = node as HastNodeLike | undefined;
  if (!pre || !Array.isArray(pre.children)) return undefined;
  const code = pre.children.find((child) => child?.tagName === 'code');
  const classes = code?.properties?.className;
  const list = Array.isArray(classes) ? classes : typeof classes === 'string' ? [classes] : [];
  for (const entry of list) {
    const match = /language-([\w+#-]+)/.exec(String(entry));
    if (match?.[1]) return match[1];
  }
  return undefined;
}
