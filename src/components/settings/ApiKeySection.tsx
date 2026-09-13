import { useState } from 'react';
import type { ApiKeyPersistence, ConnectionState } from '../../types';
import { maskApiKey } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, Switch, TextInput } from '../ui/Field';
import { StatusPill } from '../ui/StatusPill';
import { IconAlert, IconCheck, IconRefresh } from '../ui/Icon';

export interface ApiKeySectionProps {
  apiKey: string;
  persistence: ApiKeyPersistence;
  baseUrl: string;
  endpointLabel: string;
  connection: ConnectionState;
  isChecking: boolean;
  onSaveKey: (key: string) => void;
  onClearKey: () => void;
  onPersistenceChange: (mode: ApiKeyPersistence) => void;
  onBaseUrlChange: (url: string) => void;
  onRetry: () => void;
}

export function ApiKeySection({
  apiKey,
  persistence,
  baseUrl,
  endpointLabel,
  connection,
  isChecking,
  onSaveKey,
  onClearKey,
  onPersistenceChange,
  onBaseUrlChange,
  onRetry,
}: ApiKeySectionProps) {
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);

  const pending = draft.trim();
  const isUnchanged = pending === apiKey;

  const handleSave = () => {
    onSaveKey(pending);
    setDraft('');
    setRevealed(false);
  };

  const handleClear = () => {
    onClearKey();
    setDraft('');
  };

  return (
    <div className="space-y-4">
      <div className="border-line bg-surface-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
        <StatusPill connection={connection} />
        <Button size="sm" variant="ghost" onClick={onRetry} isLoading={isChecking}>
          <IconRefresh size={14} />
          Re-check
        </Button>
      </div>

      <Field
        label="NVIDIA NIM API key"
        htmlFor="api-key"
        hint={
          apiKey
            ? `Stored in this browser as ${maskApiKey(apiKey)}. Create or revoke keys at build.nvidia.com.`
            : 'Get a key from build.nvidia.com. It is saved in this browser only and sent directly to NVIDIA.'
        }
      >
        <div className="flex gap-2">
          <TextInput
            id="api-key"
            type={revealed ? 'text' : 'password'}
            value={draft}
            autoComplete="off"
            spellCheck={false}
            placeholder={apiKey ? '••••••••••••••••' : 'nvapi-…'}
            onChange={(event) => setDraft(event.target.value)}
            aria-describedby="api-key-hint"
          />
          <Button
            variant="quiet"
            onClick={() => setRevealed((value) => !value)}
            aria-pressed={revealed}
            aria-label={revealed ? 'Hide API key' : 'Show API key'}
          >
            {revealed ? 'Hide' : 'Show'}
          </Button>
        </div>
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={handleSave} disabled={!pending || isUnchanged}>
          <IconCheck size={15} />
          Save key
        </Button>
        <Button variant="quiet" onClick={handleClear} disabled={!apiKey}>
          Clear API key
        </Button>
      </div>

      <Switch
        label="Remember the key in this browser"
        hint="On: localStorage, survives restarts. Off: sessionStorage, cleared when the tab closes."
        checked={persistence === 'local'}
        onChange={(checked) => onPersistenceChange(checked ? 'local' : 'session')}
      />

      <Field
        label="API base URL"
        htmlFor="base-url"
        hint={`${endpointLabel} — change this to point at a self-hosted NIM or your own CORS proxy.`}
      >
        {/* Uncontrolled and keyed: remounting on a committed change keeps the
            field in sync without an effect, and lets the user type freely. */}
        <TextInput
          key={baseUrl}
          id="base-url"
          defaultValue={baseUrl}
          spellCheck={false}
          onBlur={(event) => onBaseUrlChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      </Field>

      <div className="border-warning/40 bg-surface-2 text-ink-muted flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-relaxed">
        <IconAlert size={15} className="text-warning mt-0.5 shrink-0" />
        <p>
          <strong className="text-ink font-semibold">Browser-only app.</strong> This page has no server, so
          your key is sent straight from your browser to the endpoint and is readable by anyone using this
          device. Never deploy a key in the build: everything prefixed with{' '}
          <code className="bg-surface-3 rounded px-1">VITE_</code> is public. Host the bundled proxy to keep
          calls off the browser's direct path — see the README.
        </p>
      </div>
    </div>
  );
}
