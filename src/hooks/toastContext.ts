import { createContext } from 'react';
import type { Toast } from '../types';

export interface ToastInput {
  tone?: Toast['tone'];
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-dismiss delay in ms; `0` keeps the toast until dismissed. */
  durationMs?: number;
}

export interface ToastApi {
  toasts: readonly Toast[];
  notify: (input: ToastInput | string) => void;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
