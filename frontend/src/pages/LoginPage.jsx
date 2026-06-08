// src/pages/LoginPage.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { name, password });
      login({ name: res.name });
      toast.success(`Xoş gəlmisiniz, ${res.name}`);
      const target = loc.state?.from || "/setup";
      nav(target, { replace: true });
    } catch (err) {
      toast.error(err.message || "Giriş alınmadı");
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-ink-900">
      <form
        onSubmit={onSubmit}
        className={`w-full max-w-sm ${shake ? "animate-shake" : ""}`}
      >
        {/* Loqo + başlıq */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-moss-500 to-clay-400 shadow-lg shadow-moss-600/40 mb-4">
            <span className="font-display text-3xl text-white">E</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Exam Station</h1>
          <p className="text-white/40 text-sm mt-1">Stansiya nəticələri</p>
        </div>

        {/* Şüşə kart */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">
                İstifadəçi adı
              </label>
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">
                Parol
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3 rounded-xl bg-white text-ink-900 font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Yoxlanılır..." : "Daxil ol"}
            </button>
          </div>
        </div>

        <p className="text-xs text-white/30 mt-6 text-center">
          İlk açılış üçün: admin / admin123 · Default parolu mütləq dəyişdirin.
        </p>
      </form>
    </div>
  );
}