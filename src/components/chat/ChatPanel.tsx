import type { Conversation } from '../../types';
import { Composer } from './Composer';
import { EmptyState } from './EmptyState';
import { MessageList } from './MessageList';

export interface ChatPanelProps {
  conversation: Conversation | null;
  /** Id of the assistant message currently receiving tokens. */
  streamingMessageId: string | null;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  hasApiKey: boolean;
  modelName: string;
  onOpenSettings: () => void;
  onSelectSuggestion: (text: string) => void;
}

/** Transcript plus composer, or the first-run guidance when empty. */
export function ChatPanel({
  conversation,
  streamingMessageId,
  canRegenerate,
  onRegenerate,
  onSend,
  onStop,
  isStreaming,
  hasApiKey,
  modelName,
  onOpenSettings,
  onSelectSuggestion,
}: ChatPanelProps) {
  const messages = conversation?.messages ?? [];
  const settings = conversation?.settings;

  return (
    <>
      {messages.length === 0 ? (
        <div className="scroll-thin flex-1 overflow-y-auto">
          <EmptyState
            hasApiKey={hasApiKey}
            modelName={modelName}
            onOpenSettings={onOpenSettings}
            onSelectSuggestion={onSelectSuggestion}
          />
        </div>
      ) : (
        <MessageList
          messages={messages}
          streamingMessageId={streamingMessageId}
          canRegenerate={canRegenerate}
          onRegenerate={onRegenerate}
        />
      )}

      <Composer
        key={conversation?.id ?? 'no-conversation'}
        onSend={onSend}
        onStop={onStop}
        isStreaming={isStreaming}
        disabled={conversation === null}
        disabledReason="Create a conversation to start chatting"
        hint={
          settings
            ? `${settings.stream ? 'Streaming' : 'Single response'} · temperature ${settings.temperature.toFixed(
                2,
              )} · max ${settings.maxTokens} tokens`
            : undefined
        }
      />
    </>
  );
}
