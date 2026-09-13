import { useRef, useState } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button } from '../ui/Button';
import { useToasts } from '../../hooks/useToasts';
import { downloadTextFile } from '../../utils/download';
import { fileStamp } from '../../utils/time';
import { ImportFormatError } from '../../storage/conversations';
import { IconDownload, IconTrash, IconUpload } from '../ui/Icon';
import { Section } from './Section';

export interface DataSectionProps {
  conversationCount: number;
  onExport: () => string;
  onImport: (raw: string) => { added: number; updated: number; skipped: number };
  onClearEverything: () => void;
}

/** Export / import / wipe. Everything stays on the device. */
export function DataSection({ conversationCount, onExport, onImport, onClearEverything }: DataSectionProps) {
  const { notify } = useToasts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleExport = () => {
    downloadTextFile(`nim-chat-${fileStamp()}.json`, onExport());
    notify({ tone: 'success', message: `Exported ${conversationCount} conversation(s).` });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const raw = await file.text();
      const result = onImport(raw);
      notify({
        tone: 'success',
        message: `Imported ${result.added} new, updated ${result.updated}, skipped ${result.skipped}.`,
      });
    } catch (error) {
      notify({
        tone: 'error',
        message: error instanceof ImportFormatError ? error.message : 'That file could not be imported.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Section
      title="Your data"
      description="Conversations live in this browser's local storage. Nothing is uploaded anywhere except the messages you send to the NIM API."
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="quiet" onClick={handleExport} disabled={conversationCount === 0}>
          <IconDownload size={15} />
          Export JSON
        </Button>
        <Button variant="quiet" onClick={() => fileInputRef.current?.click()}>
          <IconUpload size={15} />
          Import JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Choose a conversation export file"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </div>

      <div className="border-danger/30 bg-surface-2 rounded-lg border p-3">
        <p className="text-ink-muted text-xs leading-relaxed">
          Delete everything this app has stored: conversations, settings and the API key. The page reloads
          afterwards.
        </p>
        <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirmClear(true)}>
          <IconTrash size={14} />
          Delete all local data
        </Button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Delete all local data?"
        message="Conversations, settings and the stored API key are removed from this browser. This cannot be undone."
        confirmLabel="Delete and reload"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          onClearEverything();
        }}
      />
    </Section>
  );
}
