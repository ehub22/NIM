import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Conversation } from '../types';
import { useConversations } from '../hooks/useConversations';
import { useSettings } from '../hooks/useSettings';
import { useToasts } from '../hooks/useToasts';
import { useTheme } from '../hooks/useTheme';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useModels } from '../hooks/useModels';
import { useChatController } from '../hooks/useChatController';
import { getEndpointConfig } from '../services/nim/config';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { ChatPanel } from '../components/chat/ChatPanel';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SettingsDialog } from '../components/settings/SettingsDialog';
import { clearAllLocalData } from '../storage/settings';

/**
 * The single view of the app: conversation rail, transcript and composer.
 * All cross-cutting state comes from the hooks; this component only wires
 * them together and owns transient UI state (drawers, dialogs).
 */
export function ChatPage() {
  const { settings, apiKey, updateSettings } = useSettings();
  const conversations = useConversations();
  const { notify } = useToasts();

  const resolvedTheme = useTheme(settings.theme);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const endpoint = useMemo(() => getEndpointConfig(), []);

  const [sidebarOpenState, setSidebarOpenState] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);

  const { models, usingFallback, isLoading, connection, refresh } = useModels({
    apiKey,
    baseUrl: settings.baseUrl,
  });

  const { send, regenerate, stop, streamingConversationId, isStreaming } = useChatController({
    onRequestSettings: () => setSettingsOpen(true),
  });

  const active = conversations.active;
  const conversationList = conversations.conversations;
  const createConversation = conversations.create;

  // The app always has a conversation to type into.
  useEffect(() => {
    if (conversationList.length === 0) createConversation();
  }, [conversationList.length, createConversation]);

  // On desktop the rail is permanently visible, so the drawer state is derived
  // rather than reset from an effect.
  const sidebarOpen = !isDesktop && sidebarOpenState;

  const openSettings = useCallback(() => setSettingsOpen(true), []);

  // Keyboard shortcuts: new conversation, settings, close drawer.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        conversations.create();
        return;
      }
      if (mod && event.key === ',') {
        event.preventDefault();
        openSettings();
        return;
      }
      if (event.key === 'Escape' && sidebarOpenState) setSidebarOpenState(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [conversations, openSettings, sidebarOpenState]);

  const activeModelName = useMemo(() => {
    if (!active) return settings.model;
    return models.find((model) => model.id === active.model)?.name ?? active.model;
  }, [active, models, settings.model]);

  const handleModelChange = (modelId: string) => {
    if (active) conversations.setModel(active.id, modelId);
    updateSettings({ model: modelId });
  };

  const handleToggleTheme = () => {
    updateSettings({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' });
  };

  const handleDeleteConversation = () => {
    if (!pendingDelete) return;
    conversations.remove(pendingDelete.id);
    notify({ message: `Deleted "${pendingDelete.title}".` });
    setPendingDelete(null);
  };

  const handleClearEverything = () => {
    clearAllLocalData();
    window.location.reload();
  };

  const handleSuggestion = (text: string) => {
    if (!active) return;
    send(active.id, text);
  };

  const lastAssistantId = active
    ? [...active.messages].reverse().find((message) => message.role === 'assistant')?.id
    : undefined;

  const canRegenerate = Boolean(active && lastAssistantId) && streamingConversationId !== active?.id;

  return (
    <div className="bg-canvas flex h-full w-full overflow-hidden">
      <Sidebar
        conversations={conversations.conversations}
        activeId={conversations.activeId}
        connection={connection}
        storageWarning={conversations.storageWarning}
        open={sidebarOpen}
        onSelect={conversations.select}
        onNew={() => {
          createConversation();
          setSidebarOpenState(false);
        }}
        onRename={(id, title) => {
          conversations.rename(id, title);
          notify({ tone: 'success', message: 'Conversation renamed.' });
        }}
        onDelete={(id) =>
          setPendingDelete(conversations.conversations.find((entry) => entry.id === id) ?? null)
        }
        onClearAll={() => notify({ message: 'All conversations deleted.' })}
        onOpenSettings={openSettings}
        onClose={() => setSidebarOpenState(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <Header
          title={active?.title ?? 'New conversation'}
          subtitle={`${activeModelName} · ${active?.messages.length ?? 0} messages`}
          models={models}
          model={active?.model ?? settings.model}
          usingFallback={usingFallback}
          connection={connection}
          theme={settings.theme}
          resolvedTheme={resolvedTheme}
          isStreaming={isStreaming}
          onModelChange={handleModelChange}
          onToggleTheme={handleToggleTheme}
          onOpenSettings={openSettings}
          onToggleSidebar={() => setSidebarOpenState((value) => !value)}
        />

        <ChatPanel
          conversation={active}
          streamingMessageId={streamingConversationId === active?.id ? (lastAssistantId ?? null) : null}
          canRegenerate={canRegenerate}
          onRegenerate={() => {
            if (active) regenerate(active.id);
          }}
          onSend={(text) => {
            if (active) send(active.id, text);
          }}
          onStop={stop}
          isStreaming={isStreaming}
          hasApiKey={apiKey.length > 0}
          modelName={activeModelName}
          onOpenSettings={openSettings}
          onSelectSuggestion={handleSuggestion}
        />
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        models={models}
        usingFallback={usingFallback}
        connection={connection}
        isChecking={isLoading}
        endpointLabel={endpoint.endpointLabel}
        resolvedTheme={resolvedTheme}
        onRefreshModels={refresh}
        onClearEverything={handleClearEverything}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this conversation?"
        message={
          pendingDelete
            ? `"${pendingDelete.title}" and its ${pendingDelete.messages.length} messages will be removed from this browser.`
            : ''
        }
        confirmLabel="Delete conversation"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConversation}
      />
    </div>
  );
}
