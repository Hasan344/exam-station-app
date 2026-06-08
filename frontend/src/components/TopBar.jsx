import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
    // Diqqət: modal <header>-dən KƏNARDA render olunur.
    // <header> backdrop-blur (backdrop-filter) işlədir və bu, daxilindəki
    // `position: fixed` elementlər üçün yeni containing block yaradır —
    // nəticədə modal tam ekran yerinə header zolağına sıxışırdı.
    <>
      <header className="bg-ink-900/80 backdrop-blur-xl border-b border-white/10 text-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            {/* Brend */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-moss-500 to-clay-400 grid place-items-center font-display text-white text-lg shadow-md shadow-moss-600/30">
                E
              </div>
              <span className="hidden sm:block font-display text-lg leading-none">Exam Station</span>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              <NavTab to="/" exact label="İş səhifəsi" />
              <NavTab to="/results" label="Nəticələr" />
              {isAdmin && <NavTab to="/setup" label="Quraşdırma" />}
              {isAdmin && <NavTab to="/admin" label="Admin" />}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <SetupBreadcrumb setup={setup} />

            {user && (
              <div className="flex items-center gap-3 text-sm">
                <span className="hidden sm:inline text-white/50">{user.name}</span>
                {isStation ? (
                  <button
                    onClick={() => setUnlockOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-colors text-xs"
                  >
                    Admin girişi
                  </button>
                ) : (
                  <button
                    onClick={onLogout}
                    className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-white/70 hover:text-white hover:bg-rust-500/80 transition-colors text-xs"
                  >
                    Çıxış
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <AdminUnlockModal
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => nav("/setup")}
      />
    </>
  );
}

function NavTab({ to, exact, label }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) => `
        px-4 py-2 rounded-xl text-sm font-medium transition-colors
        ${isActive
          ? "bg-white text-ink-900"
          : "text-white/60 hover:text-white hover:bg-white/10"}
      `}
    >{label}</NavLink>
  );
}

function SetupBreadcrumb({ setup }) {
  const parts = [];
  if (setup.exam) parts.push({ label: "İmtahan", value: setup.exam.name });

  if (!parts.length) return null;

  return (
    <div className="hidden lg:flex items-center gap-2 text-xs">
      {parts.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-white/30">·</span>}
          <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70">
            {p.label}: <span className="text-white font-medium">{p.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}