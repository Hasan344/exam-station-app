// src/App.jsx
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import SetupPage from "./pages/SetupPage.jsx";
import WorkstationPage from "./pages/WorkstationPage.jsx";
import ResultsListPage from "./pages/ResultsListPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import TopBar from "./components/TopBar.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useSetup } from "./context/SetupContext.jsx";

function Protected({ children }) {
  const { user, loaded } = useAuth();
  const loc = useLocation();
  if (!loaded) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

function RequireSetup({ children }) {
  const { isReady } = useSetup();
  if (!isReady) return <Navigate to="/setup" replace />;
  return children;
}

function Shell({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">{children}</main>
      <footer className="border-t border-ink-200 bg-paper-100 text-xs text-ink-400 text-center py-3">
        Exam Station · oflayn yığım vasitəsi
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/setup"
        element={<Protected><Shell><SetupPage /></Shell></Protected>}
      />

      <Route
        path="/"
        element={
          <Protected>
            <Shell><RequireSetup><WorkstationPage /></RequireSetup></Shell>
          </Protected>
        }
      />

      <Route
        path="/results"
        element={<Protected><Shell><ResultsListPage /></Shell></Protected>}
      />

      <Route
        path="/admin"
        element={<Protected><Shell><AdminPage /></Shell></Protected>}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
