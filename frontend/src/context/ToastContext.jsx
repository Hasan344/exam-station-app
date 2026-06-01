// src/context/ToastContext.jsx
import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(ts => ts.filter(t => t.id !== id));
  }, []);

  const push = useCallback((kind, message, ms = 3500) => {
    const id = nextId++;
    setToasts(ts => [...ts, { id, kind, message }]);
    if (ms > 0) setTimeout(() => remove(id), ms);
    return id;
  }, [remove]);

  const toast = {
    info:    (m, ms) => push("info", m, ms),
    success: (m, ms) => push("success", m, ms),
    warn:    (m, ms) => push("warn", m, ms),
    error:   (m, ms) => push("error", m, ms ?? 5000),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            className={`
              px-4 py-3 rounded-soft shadow-deep text-sm cursor-pointer
              border transition-all
              ${t.kind === "error"   ? "bg-rust-500 text-paper border-rust-600" : ""}
              ${t.kind === "warn"    ? "bg-sun-500 text-ink-900 border-sun-400" : ""}
              ${t.kind === "success" ? "bg-moss-500 text-paper border-moss-600" : ""}
              ${t.kind === "info"    ? "bg-ink-700 text-paper border-ink-800"   : ""}
            `}
          >{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast ToastProvider içində istifadə olunmalıdır");
  return ctx;
}
