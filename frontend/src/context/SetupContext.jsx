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
//
// SECTION 3 (ekspert bölməsi):
//   Bu bölmədə hərəkət inputları əvəzinə EKSPERT inputları göstərilir
//   (hər ekspert hər tələbəyə 0–100 tam bal yazır). isExpertSection bunu bildirir.

import { createContext, useContext, useEffect, useState } from "react";

const SetupContext = createContext(null);
const STORAGE_KEY = "examstation_setup";

// Ekspert bazlı qiymətləndirmə tətbiq olunan bölmənin ID-si.
// Lazım olsa burada dəyişdirin (və ya sect_code-a görə yoxlayın).
export const EXPERT_SECTION_ID = 3;

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

  // Section 3 → ekspert bölməsi.
  const isExpertSection = setup.section?.id === EXPERT_SECTION_ID;

  // Ekspert bölməsində hərəkət seçimi tələb olunmur (inputlar ekspertlərdən gəlir),
  // ona görə hazırlıq şərti də fərqlidir.
  const isReady = isExpertSection
    ? !!(setup.section && setup.exam)
    : !!(
        setup.section &&
        setup.exam &&
        setup.exercises &&
        setup.exercises.length > 0
      );

  const value = {
    setup,
    isReady,
    isExpertSection,
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