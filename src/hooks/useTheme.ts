import { useEffect, useState } from 'react';
import type { ThemePreference } from '../types';

export type ResolvedTheme = 'light' | 'dark';

const QUERY = '(prefers-color-scheme: light)';

/**
 * Resolves a theme preference against the OS setting, applies it to
 * `<html data-theme>` and follows the OS while the preference is `system`.
 */
export function useTheme(preference: ThemePreference): ResolvedTheme {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    window.matchMedia(QUERY).matches ? 'light' : 'dark',
  );

  useEffect(() => {
    const list = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'light' : 'dark');
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const resolved = preference === 'system' ? systemTheme : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [preference, systemTheme]);

  return preference === 'system' ? systemTheme : preference;
}
