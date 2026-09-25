import { createContext } from 'react';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
}

export interface ToastValue {
  toasts: ToastMessage[];
  notify: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastValue | null>(null);
