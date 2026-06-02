// src/components/AdminUnlockModal.jsx
//
// Station rejimindən çıxıb admin icazələrini açmaq üçün modal.
// İstifadəçinin admin parolunu yenidən soruşur (useAuth().unlockAdmin).

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function AdminUnlockModal({ open, onClose, onUnlocked }) {
  const { user, unlockAdmin } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (open) {
      setPw(""); setError("");
      setTimeout(() => ref.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!pw) return;
    setBusy(true);
    setError("");
    try {
      await unlockAdmin(pw);
      toast.success("Admin icazələri açıldı");
      onUnlocked?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Parol yanlışdır");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="w-full max-w-sm bg-paper border border-ink-200 rounded-soft shadow-deep p-6">
        <h3 className="font-display text-xl text-ink-900">Admin girişi</h3>
        <p className="text-sm text-ink-600 mt-1">
          Quraşdırma və admin əməliyyatları üçün <strong>{user?.name || "admin"}</strong> parolunu daxil edin.
        </p>
        <input
          ref={ref}
          type="password"
          className="field mt-4"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder="Admin parolu"
          autoComplete="current-password"
        />
        {error && <div className="text-sm text-rust-600 mt-2">{error}</div>}
        <div className="mt-5 flex justify-end gap-3">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Ləğv et</button>
          <button className="btn-primary px-6" onClick={submit} disabled={busy || !pw}>
            {busy ? "Yoxlanılır..." : "Aç"}
          </button>
        </div>
      </div>
    </div>
  );
}
