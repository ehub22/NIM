import type { ReactNode } from 'react';
import { ToastContext } from '../../hooks/toastContext';
import { useToastsController } from '../../hooks/useToastsController';

/** Makes the toast queue available to the tree and renders the viewport. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const api = useToastsController();
  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
}
