import { useContext } from 'react';
import { ToastContext } from './toastContext';
import type { ToastApi } from './toastContext';

/** Accesses the toast queue. Throws when used outside `ToastProvider`. */
export function useToasts(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToasts must be used inside a <ToastProvider>.');
  return api;
}
