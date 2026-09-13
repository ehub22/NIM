/**
 * In-memory `Storage` implementation.
 *
 * Used as a fallback when `localStorage`/`sessionStorage` are unavailable
 * (private browsing in some engines, sandboxed iframes, SSR) so the app still
 * runs for the current session instead of throwing, and as the storage double
 * in unit tests.
 */
export class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}
