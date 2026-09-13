import type { ConnectionState, ModelInfo, ThemePreference } from '../../types';
import { cn } from '../../utils/cn';
import { IconButton } from '../ui/IconButton';
import { StatusPill } from '../ui/StatusPill';
import { ModelSelector } from '../settings/ModelSelector';
import { IconMenu, IconMoon, IconSettings, IconSun } from '../ui/Icon';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  models: readonly ModelInfo[];
  model: string;
  usingFallback: boolean;
  connection: ConnectionState;
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  isStreaming: boolean;
  onModelChange: (modelId: string) => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
}

export function Header({
  title,
  subtitle,
  models,
  model,
  usingFallback,
  connection,
  theme,
  resolvedTheme,
  isStreaming,
  onModelChange,
  onToggleTheme,
  onOpenSettings,
  onToggleSidebar,
}: HeaderProps) {
  const themeLabel = theme === 'system' ? `Theme: system (${resolvedTheme})` : `Theme: ${resolvedTheme}`;

  return (
    <header className="border-line bg-surface flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5 sm:px-5">
      <IconButton label="Toggle conversation sidebar" onClick={onToggleSidebar} className="lg:hidden">
        <IconMenu />
      </IconButton>

      <div className="min-w-0 flex-1">
        <h1 className="text-ink truncate text-sm font-semibold">{title}</h1>
        <p className="text-ink-faint truncate text-[0.6875rem]">
          {subtitle ?? 'NVIDIA NIM · OpenAI-compatible API'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <ModelSelector
          models={models}
          value={model}
          onChange={onModelChange}
          disabled={isStreaming}
          className={cn('w-[10rem] sm:w-[15rem]')}
        />
        <StatusPill connection={connection} className="hidden sm:inline-flex" />

        <IconButton label={themeLabel} onClick={onToggleTheme}>
          {resolvedTheme === 'dark' ? <IconSun /> : <IconMoon />}
        </IconButton>
        <IconButton label="Open settings" onClick={onOpenSettings}>
          <IconSettings />
        </IconButton>
      </div>

      {usingFallback ? (
        <p className="text-ink-faint w-full text-[0.6875rem] sm:hidden">
          Showing bundled models — live discovery unavailable.
        </p>
      ) : null}
    </header>
  );
}
