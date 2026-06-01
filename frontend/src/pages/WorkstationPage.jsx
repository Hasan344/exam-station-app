// src/pages/WorkstationPage.jsx
//
// Stansiya işçi səhifəsi:
//   1. Operator sıra № daxil edir → tələbə backend-dən gətirilir
//   2. Tələbənin məlumatları (Ad/Soyad, iş №, ixtisas) göstərilir
//   3. Setup-da seçilmiş HƏRƏKƏTLƏRİN HAMISI üçün yan-yana input göstərilir
//      (əgər əvvəlcədən yazılmışsa — dəyər prefill olur)
//   4. "Hamısını saxla" → /results/bulk → toast "Yadda saxlandı"
//      → avtomatik s_nomer artırılır və növbəti tələbə üçün hazırlaşır

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSetup } from "../context/SetupContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { PageHeader, Card, Spinner, EmptyState } from "../components/ui/Primitives.jsx";
import ExerciseInput from "../components/ExerciseInput.jsx";
import { fullName, genderLabel, formatDate } from "../lib/format.js";

const blankInput = () => ({ rawValue: "", isRefused: false, notes: "" });

// ─── Tələbə şəkli komponenti ───
// /students/:id/photo backend endpointini birbaşa <img> ilə yükləyir.
// Şəkil yoxdursa default placeholder göstərilir.
function StudentPhoto({ studentId }) {
  const [hasError, setHasError] = useState(false);

  // studentId dəyişəndə error vəziyyəti reset olur
  useEffect(() => { setHasError(false); }, [studentId]);

  if (hasError || !studentId) {
    return (
      <div className="w-32 h-40 rounded-soft bg-ink-100 border border-ink-200 flex items-center justify-center text-ink-300 text-xs text-center px-2">
        Şəkil yoxdur
      </div>
    );
  }

  return (
    <img
      src={`/students/${studentId}/photo?ts=${studentId}`}
      alt="Tələbə şəkli"
      onError={() => setHasError(true)}
      className="w-32 h-40 object-cover rounded-soft border border-ink-200 bg-ink-50"
    />
  );
}

export default function WorkstationPage() {
  const { setup } = useSetup();
  const { user } = useAuth();
  const toast = useToast();

  const [sNomer, setSNomer] = useState("");
  const [student, setStudent] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [inputs, setInputs] = useState({});      // exerciseId → { rawValue, isRefused, notes }
  const [saving, setSaving] = useState(false);
  const sNomerRef = useRef(null);

  // Açılışda sNomer input-una fokus
  useEffect(() => { sNomerRef.current?.focus(); }, []);

  // Setup dəyişərsə input-ları sıfırla
  const initInputs = useCallback((existingResults = []) => {
    const next = {};
    for (const ex of setup.exercises) {
      const found = existingResults.find(r => r.exercise_id === ex.id);
      if (found) {
        next[ex.id] = {
          rawValue: found.is_refused ? "" : (found.raw_value ?? ""),
          isRefused: !!found.is_refused,
          notes: found.notes ?? "",
        };
      } else {
        next[ex.id] = blankInput();
      }
    }
    setInputs(next);
  }, [setup.exercises]);

  const lookupStudent = async () => {
    if (!sNomer) return toast.warn("Sıra nömrəsi daxil edin");
    setLoadingStudent(true);
    setStudent(null);
    try {
      const s = await api.get(
        `/students/lookup?examId=${setup.exam.id}&commissionNo=${setup.commission.commission_no}&sNomer=${sNomer}`
      );
      const existing = await api.get(`/students/${s.id}/results`);
      setStudent(s);
      initInputs(existing);
      if (existing.length > 0) {
        toast.info(`Bu tələbənin ${existing.length} nəticəsi əvvəldən mövcuddur — redaktə edə bilərsiniz`);
      }
    } catch (err) {
      toast.error(err.message);
      setSNomer("");
      sNomerRef.current?.focus();
    } finally {
      setLoadingStudent(false);
    }
  };

  const onSNomerKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupStudent();
    }
  };

  const updateInput = (exId, patch) => {
    setInputs(prev => ({ ...prev, [exId]: { ...prev[exId], ...patch } }));
  };

  const focusInputAt = (i) => {
    const exId = setup.exercises[i]?.id;
    if (!exId) return;
    // input-lar `ExerciseInput` daxilində öz ref-lərini saxlayır,
    // sadəcə ardıcıl DOM elementinə fokus veririk
    const card = document.querySelectorAll(".workstation-grid > .exercise-slot")[i];
    const inp = card?.querySelector("input[type=number]");
    inp?.focus();
  };

  const validate = () => {
    for (const ex of setup.exercises) {
      const inp = inputs[ex.id];
      if (!inp) return `${ex.name}: dəyər daxil edilməyib`;
      if (inp.isRefused) continue;
      if (inp.rawValue === "" || inp.rawValue === null) {
        return `${ex.name}: dəyər daxil edin və ya imtina işarələyin`;
      }
      const n = Number(inp.rawValue);
      if (Number.isNaN(n) || n < 0) return `${ex.name}: dəyər müsbət ədəd olmalıdır`;
    }
    return null;
  };

  const handleSaveAll = async () => {
    const errMsg = validate();
    if (errMsg) return toast.warn(errMsg);

    setSaving(true);
    try {
      const items = setup.exercises.map(ex => ({
        studentId: student.id,
        examId: setup.exam.id,
        exerciseId: ex.id,
        rawValue: inputs[ex.id].isRefused ? null : Number(inputs[ex.id].rawValue),
        isRefused: !!inputs[ex.id].isRefused,
        notes: inputs[ex.id].notes || null,
      }));

      const result = await api.post("/results/bulk", {
        recordedBy: user?.name || "operator",
        items,
      });

      toast.success(`✓ ${result.saved} nəticə yadda saxlanıldı — ${fullName(student)}`);

      // Növbəti sıra № üçün hazırlaş
      const nextNo = (Number(sNomer) || 0) + 1;
      setStudent(null);
      setInputs({});
      setSNomer(String(nextNo));
      setTimeout(() => sNomerRef.current?.focus(), 100);
    } catch (err) {
      toast.error("Saxlanılmadı: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setStudent(null);
    setInputs({});
    const nextNo = (Number(sNomer) || 0) + 1;
    setSNomer(String(nextNo));
    setTimeout(() => sNomerRef.current?.focus(), 100);
  };

  // Hələ heç bir tələbə yoxdursa — yalnız sıra № axtarış
  const exerciseCount = setup.exercises.length;

  return (
    <>
      <PageHeader
        title="Stansiya"
        subtitle={`№${setup.commission.commission_no} · ${setup.exam.name} · ${exerciseCount} hərəkət`}
      />

      <Card title="Tələbə axtarışı" subtitle="Sıra nömrəsini daxil edin və Enter basın">
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="label">Sıra №</label>
            <input
              ref={sNomerRef}
              type="number"
              value={sNomer}
              onChange={(e) => setSNomer(e.target.value)}
              onKeyDown={onSNomerKey}
              placeholder="məs. 12"
              className="huge-input field"
              autoFocus
            />
          </div>
          <button className="btn-primary h-12 px-6" onClick={lookupStudent} disabled={loadingStudent}>
            {loadingStudent ? "Axtarılır..." : "Tap"}
          </button>
          {student && (
            <button className="btn-ghost h-12" onClick={handleSkip}>
              Növbəti
            </button>
          )}
        </div>
      </Card>

      {loadingStudent && <div className="mt-6"><Spinner label="Tələbə axtarılır..." /></div>}

      {student && !loadingStudent && (
        <>
          <Card className="mt-6" title="Tələbə məlumatı"
                subtitle={`İş №: ${student.is_n} · Sıra: ${student.s_nomer}`}>
            <div className="flex gap-5 items-start">
              <StudentPhoto studentId={student.id} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm flex-1">
                <div>
                  <div className="text-ink-400 text-xs uppercase">Soyad Ad Ata</div>
                  <div className="font-medium text-ink-900 mt-0.5">{fullName(student)}</div>
                </div>
                <div>
                  <div className="text-ink-400 text-xs uppercase">Cins</div>
                  <div className="font-medium text-ink-900 mt-0.5">{genderLabel(student.gender)}</div>
                </div>
                <div>
                  <div className="text-ink-400 text-xs uppercase">Doğum tarixi</div>
                  <div className="font-medium text-ink-900 mt-0.5">{formatDate(student.birth_date)}</div>
                </div>
                <div>
                  <div className="text-ink-400 text-xs uppercase">İxtisas</div>
                  <div className="font-medium text-ink-900 mt-0.5">
                    {student.kodixtisas} {student.ixtisas_name && `· ${student.ixtisas_name}`}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="mt-6 workstation-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
            {setup.exercises.map((ex, i) => (
              <div key={ex.id} className="exercise-slot">
                <ExerciseInput
                  exercise={ex}
                  index={i}
                  total={exerciseCount}
                  value={inputs[ex.id]?.rawValue ?? ""}
                  isRefused={inputs[ex.id]?.isRefused ?? false}
                  notes={inputs[ex.id]?.notes ?? ""}
                  onChange={(v)        => updateInput(ex.id, { rawValue: v })}
                  onRefuseChange={(v)  => updateInput(ex.id, { isRefused: v })}
                  onNotesChange={(v)   => updateInput(ex.id, { notes: v })}
                  onEnterNext={() => {
                    if (i + 1 < exerciseCount) focusInputAt(i + 1);
                    else handleSaveAll();
                  }}
                  autoFocus={i === 0}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 sticky bottom-4 z-10 flex items-center justify-between p-4 bg-paper border border-ink-200 rounded-soft shadow-deep">
            <div className="text-sm text-ink-600">
              {exerciseCount} hərəkət dolduruldu? Yadda saxla və avtomatik olaraq №{(Number(sNomer) || 0) + 1}-ə keçir.
            </div>
            <button className="btn-primary px-8 py-3 text-lg" onClick={handleSaveAll} disabled={saving}>
              {saving ? "Saxlanılır..." : "Hamısını saxla →"}
            </button>
          </div>
        </>
      )}

      {!student && !loadingStudent && (
        <Card className="mt-6">
          <EmptyState
            icon="◯"
            title="Tələbə seçilməyib"
            hint="Yuxarıda sıra nömrəsini daxil edib Enter basın"
          />
        </Card>
      )}
    </>
  );
}
