import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query, e.g. the desktop breakpoint.
 *
 * `query` is expected to be a stable string (it is used to build the initial
 * state and is not re-subscribed against).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
