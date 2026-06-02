// src/context/AuthContext.jsx
//
// İki rejimli giriş:
//   • mode = "admin"   → tam icazə (Quraşdırma, Admin panel, İdxal, Eksport, Parol...)
//   • mode = "station" → MƏHDUD rejim: yalnız qiymət daxil/redaktə + nəticələrə baxış/ixrac
//
// Axın:
//   1) Sistemə giriş → mode "admin"
//   2) Admin stansiya parametrlərini seçir və "Stansiyanı başlat" → lockStation() → mode "station"
//   3) Station rejimində Quraşdırma/Admin BAĞLIDIR.
//      Geri qayıtmaq üçün admin parolu yenidən tələb olunur → unlockAdmin()
//
// mode sessionStorage-da saxlanılır ki, səhifə yenilənəndə kilid qalsın.

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api.js";

const AuthContext = createContext(null);
const USER_KEY = "examstation_user";
const MODE_KEY = "examstation_mode";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("admin");   // "admin" | "station"
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(USER_KEY);
      if (raw) setUser(JSON.parse(raw));
      const m = sessionStorage.getItem(MODE_KEY);
      if (m === "station" || m === "admin") setMode(m);
    } catch {}
    setLoaded(true);
  }, []);

  const persistMode = (m) => {
    setMode(m);
    try { sessionStorage.setItem(MODE_KEY, m); } catch {}
  };

  const login = (u) => {
    setUser(u);
    persistMode("admin");
    try { sessionStorage.setItem(USER_KEY, JSON.stringify(u)); } catch {}
  };

  const logout = () => {
    setUser(null);
    persistMode("admin");
    try {
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(MODE_KEY);
    } catch {}
  };

  // Stansiyanı kilidlə (məhdud rejimə keç)
  const lockStation = () => persistMode("station");

  // Admin icazələrini yenidən aç — admin parolunu yoxlayır
  const unlockAdmin = async (password) => {
    if (!user?.name) throw new Error("İstifadəçi tapılmadı");
    // mövcud /auth/login endpointi ilə təsdiqləyirik
    await api.post("/auth/login", { name: user.name, password });
    persistMode("admin");
    return true;
  };

  const isAdmin = mode === "admin";
  const isStation = mode === "station";

  return (
    <AuthContext.Provider value={{
      user, mode, isAdmin, isStation, loaded,
      login, logout, lockStation, unlockAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider içində istifadə olunmalıdır");
  return ctx;
}
