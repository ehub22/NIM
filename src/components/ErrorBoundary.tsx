import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback so a failing subtree does not blank the whole app. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render-time crashes and offers a reload instead of a white screen. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-ink text-lg font-semibold">Something went wrong</h1>
        <p className="text-ink-muted max-w-md text-sm">
          The interface hit an unexpected error. Your conversations stay saved in this browser, so reloading
          is safe.
        </p>
        <pre className="border-line bg-surface-2 text-ink-muted max-w-md overflow-x-auto rounded-lg border p-3 text-left text-xs">
          {error.message}
        </pre>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload the app
        </Button>
      </div>
    );
  }
}
