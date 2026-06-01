// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "examstation_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  const login = (u) => {
    setUser(u);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u)); } catch {}
  };

  const logout = () => {
    setUser(null);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loaded, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider içində istifadə olunmalıdır");
  return ctx;
}
