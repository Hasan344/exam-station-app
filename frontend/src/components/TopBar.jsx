
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSetup } from "../context/SetupContext.jsx";
import AdminUnlockModal from "./AdminUnlockModal.jsx";

export default function TopBar() {
  const { user, logout, isAdmin, isStation } = useAuth();
  const { setup, reset } = useSetup();
  const nav = useNavigate();
  const [unlockOpen, setUnlockOpen] = useState(false);

  const onLogout = () => {
    logout();
    reset();
    nav("/login");
  };

  return (
    <header className="bg-ink-800 text-paper border-b border-ink-900">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">

          <nav className="hidden md:flex items-center gap-1">
            <NavTab to="/" exact label="İş səhifəsi" />
            <NavTab to="/results" label="Nəticələr" />
            {/* Yalnız admin rejimində */}
            {isAdmin && <NavTab to="/setup" label="Quraşdırma" />}
            {isAdmin && <NavTab to="/admin" label="Admin" />}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <SetupBreadcrumb setup={setup} />

          

          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-ink-300">{user.name}</span>
              {isStation ? (
                <button
                  onClick={() => setUnlockOpen(true)}
                  className="text-moss-300 hover:text-moss-200"
                >
                  Admin girişi
                </button>
              ) : (
                <button onClick={onLogout} className="text-rust-400 hover:text-rust-500">
                  Çıxış
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <AdminUnlockModal
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => nav("/setup")}
      />
    </header>
  );
}

function NavTab({ to, exact, label }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) => `
        px-3 py-1.5 rounded-soft text-sm
        ${isActive ? "bg-ink-700 text-paper" : "text-ink-300 hover:text-paper hover:bg-ink-700"}
      `}
    >{label}</NavLink>
  );
}

function SetupBreadcrumb({ setup }) {
  const parts = [];
  if (setup.exam)       parts.push({ label: "İmtahan", value: setup.exam.name });

  if (!parts.length) return null;

  return (
    <div className="hidden lg:flex items-center gap-2 text-xs">
      {parts.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-ink-500">·</span>}
          <span className="text-ink-400">{p.label}:</span>
          <span className="text-paper font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}
