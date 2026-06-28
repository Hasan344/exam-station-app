// src/pages/SetupPage.jsx
//
// AdminSetup səhifəsi — 3 mərhələli sehrbaz:
//   1) Bölmə      → /sections
//      (yalnız bir bölmə varsa — seçimə ehtiyac yoxdur, avtomatik seçilir)
//   2) İmtahan    → /exams?sectionId=X
//      (tarix filtri ilə: yalnız imtahanı olan tarixlər; imtahanlar sətir kimi)
//   3) Hərəkətlər → /exams/:id/exercises
//                   (imtahana bağlı BÜTÜN komissiyaların hərəkətlərinin
//                    təkrarsız birləşməsi göstərilir, operator multi-select edir)
//
// Komissiya artıq burada seçilmir — o, iş səhifəsində tələbə axtarışı zamanı
// seçilir (s_nomer yalnız komissiya daxilində unikal olduğu üçün).
//
// Mərhələdən-mərhələyə keçid yalnız əvvəlki dolduqdan sonra mümkündür.
// Hər addımda əvvəlki dəyər dəyişdirilərsə, sonrakı seçimlər sıfırlanır.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetup } from "../context/SetupContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { PageHeader, Card, Chip, Spinner, EmptyState } from "../components/ui/Primitives.jsx";
import { unitLabel, formatDate } from "../lib/format.js";
import { useAuth } from "../context/AuthContext.jsx";

// ────────────────────────────────────────────────────────────────
// UZUN MƏSAFƏ QAÇIŞI — Step 3-də birləşdirmə
//
// İmtahanın komissiyalarındakı uzun məsafə qaçışları (sprint_400m / cross_1000m)
// operatora ayrı-ayrı yox, TƏK "Uzun məsafə qaçışı" seçimi kimi göstərilir.
// Düzgün exercise_code iş səhifəsində tələbənin commission_no-suna görə həll olunur.
//
// QEYD: bu siyahı WorkstationPage.jsx-dəki eyni adlı sabitlə SİNXRON qalmalıdır.
const LONG_RUN_CODES = ["sprint_400m", "cross_1000m"];
const VIRTUAL_LONG_RUN_ID = "__long_run__";

// İmtahanın hərəkət birləşməsindəki uzun qaçışları tək virtual seçimə çevir.
// Heç biri yoxdursa siyahı dəyişmir.
function collapseLongRuns(list) {
  const all = list || [];
  const longs = all.filter((e) => LONG_RUN_CODES.includes(e.code));
  if (longs.length === 0) return all;
  const order = Math.min(...longs.map((e) => e.display_order ?? 0));
  const rest = all.filter((e) => !LONG_RUN_CODES.includes(e.code));
  const virtual = {
    id: VIRTUAL_LONG_RUN_ID,
    code: VIRTUAL_LONG_RUN_ID,
    name: "Uzun məsafə qaçışı",
    unit: "min_sec",
    direction: 1,
    display_order: order,
    virtual: true,
  };
  return [...rest, virtual].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

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

// İmtahan sətri — chip əvəzinə tam enli, oxunaqlı sıra düyməsi
function ExamRow({ exam, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left flex items-center justify-between gap-3
        px-4 py-3 rounded-soft border transition-colors
        ${active
          ? "bg-moss-500 text-paper border-moss-600"
          : "bg-paper text-ink-700 border-ink-200 hover:border-moss-300 hover:bg-moss-50"}
      `}
    >
      <span className="flex flex-col min-w-0">
        <span className="font-medium truncate">{exam.name}</span>
        {exam.notes && (
          <span className={`text-xs truncate ${active ? "text-paper/80" : "text-ink-500"}`}>
            {exam.notes}
          </span>
        )}
      </span>
      <span className={`text-xs whitespace-nowrap ${active ? "text-paper/80" : "text-ink-500"}`}>
        {formatDate(exam.exam_date)}
      </span>
    </button>
  );
}

export default function SetupPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { lockStation } = useAuth();
  const { setup, setSection, setExam, setExercises, reset } = useSetup();

  const [sections, setSections] = useState([]);
  const [exams, setExams] = useState([]);
  const [allowedExercises, setAllowedExercises] = useState([]);
  const [loading, setLoading] = useState({ s: true, e: false, x: false });

  // İmtahan tarix filtri (yalnız imtahanı olan tarixlər)
  const [examDate, setExamDate] = useState(null);

  // Mərhələ statusu
  const stepDone = {
    1: !!setup.section,
    2: !!setup.exam,
    3: setup.exercises.length > 0,
  };
  const activeStep = !setup.section ? 1
                    : !setup.exam ? 2
                    : 3;

  // 1. Bölmələri yüklə
  useEffect(() => {
    api.get("/sections")
      .then(setSections)
      .catch(err => toast.error("Bölmələr yüklənmədi: " + err.message))
      .finally(() => setLoading(l => ({ ...l, s: false })));
  }, []);

  // 1b. Yalnız BİR bölmə varsa — seçimə ehtiyac yoxdur, avtomatik seç.
  //     Artıq seçilibsə (sessiyadan bərpa) toxunmuruq ki, imtahan/hərəkət sıfırlanmasın.
  useEffect(() => {
    if (!loading.s && sections.length === 1 && !setup.section) {
      setSection(sections[0]);
    }
  }, [loading.s, sections, setup.section]);

  // 2. Bölmə seçiləndə imtahanları yüklə
  useEffect(() => {
    if (!setup.section) { setExams([]); return; }
    setLoading(l => ({ ...l, e: true }));
    api.get(`/exams?sectionId=${setup.section.id}`)
      .then(setExams)
      .catch(err => toast.error("İmtahanlar yüklənmədi: " + err.message))
      .finally(() => setLoading(l => ({ ...l, e: false })));
  }, [setup.section?.id]);

  // İmtahanların təkrarsız tarixləri.
  // API onsuz da exam_date DESC qaytarır → ilk-görünüş sırası = ən yenidən ən köhnəyə.
  const examDates = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const e of exams) {
      if (e.exam_date && !seen.has(e.exam_date)) {
        seen.add(e.exam_date);
        out.push(e.exam_date);
      }
    }
    return out;
  }, [exams]);

  // Tarix filtri üçün default seçim:
  //   • cari seçim hələ də etibarlıdırsa saxla
  //   • sessiyadan bərpa olunmuş imtahan varsa onun tarixini göstər (operatorun öz seçimi)
  //   • yalnız BİR tarix varsa — onu göstər (seçimə ehtiyac yoxdur)
  //   • çox tarix varsa — AVTOMATİK seçim YOXDUR, operator özü seçir
  useEffect(() => {
    if (examDates.length === 0) { setExamDate(null); return; }
    if (examDate && examDates.includes(examDate)) return;
    if (setup.exam?.exam_date && examDates.includes(setup.exam.exam_date)) {
      setExamDate(setup.exam.exam_date);
    } else if (examDates.length === 1) {
      setExamDate(examDates[0]);
    } else {
      setExamDate(null);
    }
  }, [examDates, setup.exam?.exam_date, examDate]);

  // Seçilmiş tarixdəki imtahanlar
  const examsForDate = useMemo(
    () => exams.filter(e => e.exam_date === examDate),
    [exams, examDate]
  );

  // 3. İmtahan seçiləndə bu imtahanın bütün komissiyalarındakı hərəkətlərin
  //    təkrarsız birləşməsini yüklə (uzun qaçışlar tək virtual seçimə yığılır)
  useEffect(() => {
    if (!setup.exam) { setAllowedExercises([]); return; }
    setLoading(l => ({ ...l, x: true }));
    api.get(`/exams/${setup.exam.id}/exercises`)
      .then(list => setAllowedExercises(collapseLongRuns(list)))
      .catch(err => toast.error("Hərəkətlər yüklənmədi: " + err.message))
      .finally(() => setLoading(l => ({ ...l, x: false })));
  }, [setup.exam?.id]);

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
    if (!stepDone[3]) return toast.warn("Ən azı bir hərəkət seçin");
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
        ) : sections.length === 1 ? (
          // Tək bölmə — avtomatik seçildi, statik təsdiq
          <div className="flex items-center gap-2 text-sm text-ink-600">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-moss-500 text-paper text-xs">✓</span>
            <span>Tək bölmə avtomatik seçildi: <strong>{sections[0].name}</strong></span>
          </div>
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
            <div className="space-y-4">
              {/* Tarix filtri — yalnız imtahanı olan tarixlər (bir tarix varsa gizli) */}
              {examDates.length > 1 && (
                <div className="max-w-xs">
                  <label className="label" htmlFor="exam-date-filter">İmtahan tarixi</label>
                  <select
                    id="exam-date-filter"
                    className="field"
                    value={examDate ?? ""}
                    onChange={(e) => setExamDate(e.target.value || null)}
                  >
                    <option value="">— Tarix seçin —</option>
                    {examDates.map(d => (
                      <option key={d} value={d}>{formatDate(d)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* İmtahan siyahısı — sətir görünüşü (yalnız tarix seçildikdə) */}
              {!examDate ? (
                <EmptyState title="Tarix seçin"
                            hint="İmtahanları görmək üçün yuxarıdan tarix seçin" />
              ) : examsForDate.length === 0 ? (
                <EmptyState title="Bu tarixdə imtahan yoxdur" hint="Başqa tarix seçin" />
              ) : (
                <div className="flex flex-col gap-2">
                  {examsForDate.map(e => (
                    <ExamRow key={e.id}
                             exam={e}
                             active={setup.exam?.id === e.id}
                             onClick={() => setExam(e)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </Step>
      )}

      {/* ── Addım 3: Hərəkətlər (imtahanın bütün komissiyalarının birləşməsi) ── */}
      {stepDone[2] && (
        <Step n={3}
              title="Stansiyada keçiriləcək hərəkətlər"
              hint={`"${setup.exam.name}" imtahanındakı bütün komissiyaların hərəkətləri (təkrarsız) siyahıda göstərilir`}
              active={activeStep === 3} done={stepDone[3]}>
          {loading.x ? <Spinner /> : allowedExercises.length === 0 ? (
            <EmptyState title="Bu imtahana hərəkət təyin edilməyib"
                        hint="Admin səhifəsindən commission_exercises faylını idxal edin və komissiyaları bu imtahana bağlayın" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {allowedExercises.map(ex => (
                  <Chip key={ex.id}
                        active={selectedIds.has(ex.id)}
                        onClick={() => toggleExercise(ex)}>
                    {!ex.virtual && (
                      <span className="font-mono text-xs opacity-70">{ex.code}</span>
                    )}
                    <span className={ex.virtual ? "" : "ml-2"}>{ex.name}</span>
                    <span className="ml-2 text-xs opacity-70">({unitLabel(ex.unit)})</span>
                  </Chip>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-ink-200">
                <div className="text-sm text-ink-600">
                  Seçilmiş: <strong>{setup.exercises.length}</strong> / {allowedExercises.length}
                </div>
                <button className="btn-primary" disabled={!stepDone[3]} onClick={start}>
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