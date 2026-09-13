import { useState } from 'react';
import type { ApiKeyPersistence, ConnectionState, ModelInfo, ThemePreference } from '../../types';
import { useConversations } from '../../hooks/useConversations';
import { useSettings } from '../../hooks/useSettings';
import { useToasts } from '../../hooks/useToasts';
import { normalizeBaseUrl, resolveDefaultBaseUrl } from '../../services/nim/config';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ApiKeySection } from './ApiKeySection';
import { AppearanceSection } from './AppearanceSection';
import { DataSection } from './DataSection';
import { GenerationSection } from './GenerationSection';

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  models: readonly ModelInfo[];
  usingFallback: boolean;
  connection: ConnectionState;
  isChecking: boolean;
  endpointLabel: string;
  resolvedTheme: 'light' | 'dark';
  onRefreshModels: () => void;
  onClearEverything: () => void;
}

export function SettingsDialog({
  open,
  onClose,
  models,
  usingFallback,
  connection,
  isChecking,
  endpointLabel,
  resolvedTheme,
  onRefreshModels,
  onClearEverything,
}: SettingsDialogProps) {
  const { settings, apiKey, updateSettings, updateDefaults, setApiKey, clearApiKey } = useSettings();
  const {
    active,
    conversations,
    updateSettings: updateConversation,
    setModel,
    exportJson,
    importJson,
  } = useConversations();
  const { notify } = useToasts();
  const [tab, setTab] = useState<'connection' | 'generation' | 'appearance' | 'data'>('connection');

  const handleBaseUrlChange = (value: string) => {
    const normalized = normalizeBaseUrl(value);
    if (!normalized) {
      const fallback = resolveDefaultBaseUrl();
      updateSettings({ baseUrl: fallback });
      notify({ tone: 'error', message: `That URL is not valid. Reverted to ${fallback}.` });
      return;
    }
    if (normalized !== settings.baseUrl) updateSettings({ baseUrl: normalized });
  };

  const handleApplyToActive = () => {
    if (!active) return;
    updateConversation(active.id, settings.defaults);
    setModel(active.id, settings.model);
    notify({ tone: 'success', message: 'Settings applied to the open conversation.' });
  };

  const tabs = [
    { id: 'connection', label: 'Connection' },
    { id: 'generation', label: 'Generation' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'data', label: 'Data' },
  ] as const;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      description="Everything here is stored in this browser only."
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div
        role="tablist"
        aria-label="Settings sections"
        className="border-line bg-surface-2 mb-5 flex flex-wrap gap-1 rounded-lg border p-1"
      >
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`settings-tab-${entry.id}`}
            aria-selected={tab === entry.id}
            aria-controls={`settings-panel-${entry.id}`}
            onClick={() => setTab(entry.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
              tab === entry.id ? 'bg-surface text-ink font-medium shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`} tabIndex={0}>
        {tab === 'connection' ? (
          <ApiKeySection
            apiKey={apiKey}
            persistence={settings.apiKeyPersistence}
            baseUrl={settings.baseUrl}
            endpointLabel={endpointLabel}
            connection={connection}
            isChecking={isChecking}
            onSaveKey={(key) => {
              setApiKey(key);
              notify({ tone: 'success', message: 'API key saved to this browser.' });
            }}
            onClearKey={() => {
              clearApiKey();
              notify({ message: 'API key removed from this browser.' });
            }}
            onPersistenceChange={(mode: ApiKeyPersistence) => {
              updateSettings({ apiKeyPersistence: mode });
              notify({
                message:
                  mode === 'local'
                    ? 'The key will be remembered across browser restarts.'
                    : 'The key will be dropped when this tab closes.',
              });
            }}
            onBaseUrlChange={handleBaseUrlChange}
            onRetry={onRefreshModels}
          />
        ) : null}

        {tab === 'generation' ? (
          <GenerationSection
            models={models}
            model={settings.model}
            usingFallback={usingFallback}
            defaults={settings.defaults}
            activeConversationId={active?.id ?? null}
            onModelChange={(modelId) => updateSettings({ model: modelId })}
            onDefaultsChange={updateDefaults}
            onApplyToActiveConversation={handleApplyToActive}
          />
        ) : null}

        {tab === 'appearance' ? (
          <AppearanceSection
            theme={settings.theme}
            resolvedTheme={resolvedTheme}
            onChange={(theme: ThemePreference) => updateSettings({ theme })}
          />
        ) : null}

        {tab === 'data' ? (
          <DataSection
            conversationCount={conversations.length}
            onExport={exportJson}
            onImport={importJson}
            onClearEverything={onClearEverything}
          />
        ) : null}
      </div>
    </Modal>
  );
}
