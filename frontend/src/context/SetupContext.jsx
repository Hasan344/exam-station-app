// src/context/SetupContext.jsx
//
// Stansiya iş sessiyasının vəziyyəti:
//   • section, exam, exercises (stansiya hərəkətləri)
//   • sessionStorage-da saxlanılır ki, brauzer yenilənəndə də qalsın
//
// QEYD: komissiya artıq quraşdırma vəziyyətinin bir hissəsi DEYİL.
//   Hərəkətlər imtahana bağlı bütün komissiyaların birləşməsindən gəlir;
//   konkret komissiya isə iş səhifəsində (tələbə axtarışında) seçilir,
//   çünki s_nomer yalnız komissiya daxilində unikaldır.

import { createContext, useContext, useEffect, useState } from "react";

const SetupContext = createContext(null);
const STORAGE_KEY = "examstation_setup";

const emptyState = {
  section: null,        // { id, name, sect_code }
  exam: null,           // { id, name, exam_date, ... }
  exercises: [],        // [{ id, code, name, unit, direction, display_order }]
};

export function SetupProvider({ children }) {
  const [setup, setSetup] = useState(emptyState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setSetup({ ...emptyState, ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(setup)); } catch {}
  }, [setup, loaded]);

  const isReady = !!(
    setup.section &&
    setup.exam &&
    setup.exercises &&
    setup.exercises.length > 0
  );

  const value = {
    setup,
    isReady,
    setSection:    (s)  => setSetup(st => ({ ...st, section: s, exam: null, exercises: [] })),
    setExam:       (e)  => setSetup(st => ({ ...st, exam: e, exercises: [] })),
    setExercises:  (xs) => setSetup(st => ({ ...st, exercises: xs })),
    reset:         ()   => setSetup(emptyState),
  };

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup() {
  const ctx = useContext(SetupContext);
  if (!ctx) throw new Error("useSetup SetupProvider içində istifadə olunmalıdır");
  return ctx;
}
