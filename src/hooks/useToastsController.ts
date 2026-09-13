import { useCallback, useEffect, useRef, useState } from 'react';
import type { Toast } from '../types';
import { createId } from '../utils/id';
import type { ToastApi, ToastInput } from './toastContext';

const DEFAULT_DURATION_MS = 6000;

/** Toast queue with auto-dismiss timers. */
export function useToastsController(): ToastApi {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (input: ToastInput | string) => {
      const options: ToastInput = typeof input === 'string' ? { message: input } : input;
      const toast: Toast = {
        id: createId('toast'),
        tone: options.tone ?? 'info',
        message: options.message,
        actionLabel: options.actionLabel,
        onAction: options.onAction,
      };
      // Three at a time keeps the viewport from covering the transcript.
      setToasts((previous) => [...previous, toast].slice(-3));

      const duration = options.durationMs ?? (toast.tone === 'error' ? 10_000 : DEFAULT_DURATION_MS);
      if (duration > 0) {
        timers.current.set(
          toast.id,
          setTimeout(() => dismiss(toast.id), duration),
        );
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return { toasts, notify, dismiss };
}
