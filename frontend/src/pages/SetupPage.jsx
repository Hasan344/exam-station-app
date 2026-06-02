// src/pages/SetupPage.jsx
//
// AdminSetup səhifəsi — 4 mərhələli sehrbaz:
//   1) Bölmə      → /sections
//   2) İmtahan    → /exams?sectionId=X
//   3) Komissiya  → /sections/:id/commissions
//   4) Hərəkətlər → /commissions/:no/exercises
//                   (yalnız bu komissiyaya təyin edilmiş hərəkətlər siyahıda görsənir,
//                    operator multi-select edir)
//
// Mərhələdən-mərhələyə keçid yalnız əvvəlki dolduqdan sonra mümkündür.
// Hər addımda əvvəlki dəyər dəyişdirilərsə, sonrakı seçimlər sıfırlanır.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetup } from "../context/SetupContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { PageHeader, Card, Chip, Spinner, EmptyState } from "../components/ui/Primitives.jsx";
import { unitLabel } from "../lib/format.js";
import { useAuth } from "../context/AuthContext.jsx";

function StepNumber({ n, active, done }) {
  return (
    <span className={`
      inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium
      ${done ? "bg-moss-500 text-paper" : ""}
      ${active && !done ? "bg-ink-900 text-paper" : ""}
      ${!done && !active ? "bg-ink-100 text-ink-400" : ""}
    `}>{done ? "✓" : n}</span>
  );
}

function Step({ n, title, hint, active, done, children }) {
  return (
    <Card
      className={`mb-4 transition-opacity ${!active && !done ? "opacity-60" : ""}`}
      title={
        <span className="flex items-center gap-3">
          <StepNumber n={n} active={active} done={done} />
          <span>{title}</span>
        </span>
      }
      subtitle={hint}
    >
      {children}
    </Card>
  );
}

export default function SetupPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { lockStation } = useAuth();   
  const { setup, setSection, setExam, setExercises, setCommission, reset } = useSetup();

  const [sections, setSections] = useState([]);
  const [exams, setExams] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [allowedExercises, setAllowedExercises] = useState([]);
  const [loading, setLoading] = useState({ s: true, e: false, c: false, x: false });

  // Mərhələ statusu
  const stepDone = {
    1: !!setup.section,
    2: !!setup.exam,
    3: !!setup.commission,
    4: setup.exercises.length > 0,
  };
  const activeStep = !setup.section ? 1
                    : !setup.exam ? 2
                    : !setup.commission ? 3
                    : 4;

  // 1. Bölmələri yüklə
  useEffect(() => {
    api.get("/sections")
      .then(setSections)
      .catch(err => toast.error("Bölmələr yüklənmədi: " + err.message))
      .finally(() => setLoading(l => ({ ...l, s: false })));
  }, []);

  // 2. Bölmə seçiləndə imtahanları yüklə
  useEffect(() => {
    if (!setup.section) { setExams([]); return; }
    setLoading(l => ({ ...l, e: true }));
    api.get(`/exams?sectionId=${setup.section.id}`)
      .then(setExams)
      .catch(err => toast.error("İmtahanlar yüklənmədi: " + err.message))
      .finally(() => setLoading(l => ({ ...l, e: false })));
  }, [setup.section?.id]);

  // 3. İmtahan seçiləndə KOMİSSİYALARı bu imtahana aid pivot-dan yüklə
  //    (artıq bölmə üzrə yox — istifadəçinin tələbinə görə imtahana
  //     təyin olunmuş komissiyalar)
  useEffect(() => {
    if (!setup.exam) { setCommissions([]); return; }
    setLoading(l => ({ ...l, c: true }));
    api.get(`/exams/${setup.exam.id}/commissions`)
      .then(setCommissions)
      .catch(err => toast.error("Komissiyalar yüklənmədi: " + err.message))
      .finally(() => setLoading(l => ({ ...l, c: false })));
  }, [setup.exam?.id]);

  // 4. Komissiya seçiləndə icazə verilən hərəkətləri yüklə
  useEffect(() => {
    if (!setup.commission) { setAllowedExercises([]); return; }
    setLoading(l => ({ ...l, x: true }));
    api.get(`/commissions/${setup.commission.commission_no}/exercises`)
      .then(setAllowedExercises)
      .catch(err => toast.error("Hərəkətlər yüklənmədi: " + err.message))
      .finally(() => setLoading(l => ({ ...l, x: false })));
  }, [setup.commission?.commission_no]);

  // Hərəkət toggle
  const toggleExercise = (ex) => {
    const exists = setup.exercises.find(e => e.id === ex.id);
    if (exists) {
      setExercises(setup.exercises.filter(e => e.id !== ex.id));
    } else {
      setExercises([...setup.exercises, ex].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)));
    }
  };

  const selectedIds = useMemo(() => new Set(setup.exercises.map(e => e.id)), [setup.exercises]);

  const start = () => {
    if (!stepDone[4]) return toast.warn("Ən azı bir hərəkət seçin");
    lockStation();  
    navigate("/");
  };

  return (
    <>
      <PageHeader
        title="Stansiya quraşdırması"
        subtitle="İş başlamazdan əvvəl mərhələləri ardıcıl doldurun"
        right={
          <button className="btn-ghost" onClick={() => { reset(); toast.info("Sıfırlandı"); }}>
            Sıfırla
          </button>
        }
      />

      {/* ── Addım 1: Bölmə ── */}
      <Step n={1} title="Bölmə seçimi" hint="Bu stansiya hansı bölməyə xidmət edir?"
            active={activeStep === 1} done={stepDone[1]}>
        {loading.s ? <Spinner /> : sections.length === 0 ? (
          <EmptyState title="Bölmə yoxdur" hint="Admin səhifəsindən idxal edin" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {sections.map(s => (
              <Chip key={s.id}
                    active={setup.section?.id === s.id}
                    onClick={() => setSection(s)}>
                {s.name}
              </Chip>
            ))}
          </div>
        )}
      </Step>

      {/* ── Addım 2: İmtahan ── */}
      {stepDone[1] && (
        <Step n={2} title="İmtahan seçimi" hint={`"${setup.section.name}" bölməsində keçiriləcək imtahan`}
              active={activeStep === 2} done={stepDone[2]}>
          {loading.e ? <Spinner /> : exams.length === 0 ? (
            <EmptyState title="İmtahan yoxdur"
                        hint="Admin səhifəsindən yeni imtahan əlavə edin və ya bu bölməyə təyin edin" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {exams.map(e => (
                <Chip key={e.id}
                      active={setup.exam?.id === e.id}
                      onClick={() => setExam(e)}>
                  <span>{e.name}</span>
                  <span className="text-xs opacity-70 ml-2">{e.exam_date}</span>
                </Chip>
              ))}
            </div>
          )}
        </Step>
      )}

      {/* ── Addım 3: Komissiya ── */}
      {stepDone[2] && (
        <Step n={3} title="Komissiya seçimi" hint="Bu stansiya hansı komissiyanı qəbul edir?"
              active={activeStep === 3} done={stepDone[3]}>
          {loading.c ? <Spinner /> : commissions.length === 0 ? (
            <EmptyState title="Bu imtahana komissiya təyin olunmayıb"
                        hint="Admin panelindən 'Exam ↔ Commission' fayl idxalı və ya tələbə fayl idxalı (komissiyanı avtomatik qoşur) lazımdır" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {commissions.map(c => (
                <Chip key={c.id}
                      active={setup.commission?.id === c.id}
                      onClick={() => setCommission(c)}>
                  <span className="font-mono">№{c.commission_no}</span>
                  <span className="ml-2">{c.name}</span>
                </Chip>
              ))}
            </div>
          )}
        </Step>
      )}

      {/* ── Addım 4: Hərəkətlər (yalnız bu komissiyaya icazə verilənlər) ── */}
      {stepDone[3] && (
        <Step n={4}
              title="Stansiyada keçiriləcək hərəkətlər"
              hint={`Yalnız №${setup.commission.commission_no} komissiyasına təyin edilmiş hərəkətlər siyahıda göstərilir`}
              active={activeStep === 4} done={stepDone[4]}>
          {loading.x ? <Spinner /> : allowedExercises.length === 0 ? (
            <EmptyState title="Bu komissiyaya hərəkət təyin edilməyib"
                        hint="Admin səhifəsindən commission_exercises faylını idxal edin" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {allowedExercises.map(ex => (
                  <Chip key={ex.id}
                        active={selectedIds.has(ex.id)}
                        onClick={() => toggleExercise(ex)}>
                    <span className="font-mono text-xs opacity-70">{ex.code}</span>
                    <span className="ml-2">{ex.name}</span>
                    <span className="ml-2 text-xs opacity-70">({unitLabel(ex.unit)})</span>
                  </Chip>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-ink-200">
                <div className="text-sm text-ink-600">
                  Seçilmiş: <strong>{setup.exercises.length}</strong> / {allowedExercises.length}
                </div>
                <button className="btn-primary" disabled={!stepDone[4]} onClick={start}>
                  Stansiyanı başlat →
                </button>
              </div>
            </>
          )}
        </Step>
      )}
    </>
  );
}
