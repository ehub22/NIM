import type { ThemePreference } from '../../types';
import { SegmentedControl } from '../ui/Field';
import { IconMonitor, IconMoon, IconSun } from '../ui/Icon';
import { Section } from './Section';

export interface AppearanceSectionProps {
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  onChange: (theme: ThemePreference) => void;
}

export function AppearanceSection({ theme, resolvedTheme, onChange }: AppearanceSectionProps) {
  return (
    <Section title="Appearance" description="Your choice is remembered in this browser.">
      <SegmentedControl
        label="Colour theme"
        value={theme}
        onChange={onChange}
        options={[
          { value: 'light', label: 'Light', icon: <IconSun size={14} /> },
          { value: 'dark', label: 'Dark', icon: <IconMoon size={14} /> },
          { value: 'system', label: 'System', icon: <IconMonitor size={14} /> },
        ]}
      />
      <p className="text-ink-faint text-xs">Currently rendering in {resolvedTheme} mode.</p>
    </Section>
  );
}
