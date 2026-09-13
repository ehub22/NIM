/** Collision-resistant ids for conversations and messages. */
export function createId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18).padEnd(16, '0');
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
