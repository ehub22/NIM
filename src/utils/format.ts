/** Small presentation helpers for numbers and credentials. */

/** `nvapi-AbCdEfGhIjKl` -> `nvapi-Ab…Kl` — safe to render in the UI. */
export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return `${'•'.repeat(Math.max(trimmed.length, 4))}`;
  return `${trimmed.slice(0, 6)}${'•'.repeat(6)}${trimmed.slice(-4)}`;
}

/** `12400` -> `12.4k`, used for context-window labels and token counts. */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value) < 1000) return String(Math.round(value));
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
