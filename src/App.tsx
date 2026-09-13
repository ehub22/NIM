import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastViewport } from './components/ui/ToastViewport';
import { ConversationsProvider } from './components/providers/ConversationsProvider';
import { SettingsProvider } from './components/providers/SettingsProvider';
import { ToastProvider } from './components/ui/ToastProvider';
import { ChatPage } from './pages/ChatPage';

/**
 * Provider order matters: toasts are available everywhere, settings back the
 * conversation defaults, and the page itself sits inside an error boundary so
 * a render crash never leaves a blank screen.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SettingsProvider>
          <ConversationsProvider>
            <ChatPage />
          </ConversationsProvider>
        </SettingsProvider>
        <ToastViewport />
      </ToastProvider>
    </ErrorBoundary>
  );
}
