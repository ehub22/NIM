import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

// Only browser-environment files need the DOM test helpers; the proxy tests run
// under `@vitest-environment node`.
const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  const { cleanup } = await import('@testing-library/react');

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });

  // jsdom does not implement matchMedia, which the theme and layout hooks use.
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  }

  // jsdom has no clipboard API; `configurable` lets user-event install its own.
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      configurable: true,
      value: { writeText: vi.fn(() => Promise.resolve()), readText: vi.fn(() => Promise.resolve('')) },
    });
  }
}
