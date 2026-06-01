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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-5">
      {/* Sol — brending */}
      <div className="hidden lg:flex lg:col-span-2 bg-ink-800 text-paper p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-soft bg-moss-400 grid place-items-center font-display text-ink-900 text-xl">E</div>
            <div>
              <div className="font-display text-2xl">Exam Station</div>
              <div className="text-xs uppercase tracking-widest text-ink-300">stansiya nəticələri</div>
            </div>
          </div>

          <div className="mt-16 max-w-md">
            <h1 className="font-display text-4xl leading-tight">
              Stansiya bal yığımı.
              <span className="block text-moss-300 mt-2">Sürətli. Oflayn. Etibarlı.</span>
            </h1>
            <p className="mt-6 text-ink-300 leading-relaxed">
              Komissiyaya görə hərəkətlər seçilir, sıra № üzrə tələbə tapılır,
              bütün ölçülər tək ekranda yığılır və əsas sistemə xlsx/json ilə
              ötürülür.
            </p>
          </div>
        </div>

        <div className="text-xs text-ink-400 font-mono">
          v1.0 · oflayn rejim · SQLite
        </div>
      </div>

      {/* Sağ — form */}
      <div className="lg:col-span-3 flex items-center justify-center p-8 bg-paper">
        <form
          onSubmit={onSubmit}
          className={`w-full max-w-md ${shake ? "animate-shake" : ""}`}
        >
          <h2 className="font-display text-3xl text-ink-900 mb-1">Sistemə daxil olun</h2>
          <p className="text-sm text-ink-500 mb-8">İlk açılış üçün: admin / admin123</p>

          <div className="space-y-4">
            <div>
              <label className="label">İstifadəçi adı</label>
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field"
                placeholder="admin"
                required
              />
            </div>
            <div>
              <label className="label">Parol</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-8 py-3">
            {loading ? "Yoxlanılır..." : "Daxil ol"}
          </button>

          <p className="text-xs text-ink-400 mt-8 text-center">
            Default parolu admin panelindən mütləq dəyişdirin.
          </p>
        </form>
      </div>
    </div>
  );
}
