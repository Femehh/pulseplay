'use client';

import { useEffect, useState, createContext, useContext, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = {
  success: <CheckCircle size={16} className="text-success" />,
  error: <AlertCircle size={16} className="text-danger" />,
  warning: <AlertCircle size={16} className="text-warning" />,
  info: <Info size={16} className="text-accent" />,
};

const STYLES = {
  success: 'border-success/30 bg-success/10',
  error: 'border-danger/30 bg-danger/10',
  warning: 'border-warning/30 bg-warning/10',
  info: 'border-accent/30 bg-accent/10',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++counterRef.current}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto bg-surface ${STYLES[t.type]}`}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              {ICONS[t.type]}
              <span className="text-sm text-text flex-1">{t.message}</span>
              <button onClick={() => remove(t.id)} className="text-text-faint hover:text-text ml-1">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
