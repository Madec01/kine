import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type Kind = 'info' | 'ok' | 'danger';
interface Toast { id: number; message: string; kind: Kind }
interface ToastContextValue { notify: (message: string, kind?: Kind) => void }

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const notify = useCallback((message: string, kind: Kind = 'info') => {
    const id = ++counter.current;
    setToasts((list) => [...list.slice(-2), { id, message, kind }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), kind === 'danger' ? 7000 : 3800);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.kind === 'info' ? '' : `toast--${toast.kind}`}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast hors de ToastProvider');
  return ctx;
}

/** Turns any thrown value into a readable French sentence. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Une erreur inattendue est survenue.';
}
