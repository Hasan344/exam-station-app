// src/pages/WorkstationPage.jsx
//
// Stansiya işçi səhifəsi. İki rejim:
//   • Nəticə      → qiymət daxil/redaktə (kilid + redaktə parolu)
//   • Apellyasiya → eyni hərəkətlərə apellyasiya qiyməti (narıncı), eyni kilid məntiqi
//
// Apellyasiya rejimində hər hərəkət üçün "Dəyişdi / Dəyişmədi" seçimi var:
//   • Dəyişmədi → köhnə (əsas) nəticə apellyasiya kimi saxlanılır, parol istənmir.
//   • Dəyişdi   → yeni dəyər daxil edilir, saxlamadan əvvəl admin (redaktə) parolu istənir.
//
// KOMİSSİYA quraşdırmada və ya axtarışda iştirak ETMİR.
//   s_nomer imtahan daxilində unikal olduğu üçün lookup yalnız examId + sNomer ilə işləyir.
//   Hərəkətlər imtahana uyğun seçilir (SetupPage Addım 3 — imtahanın hərəkətlərinin birləşməsi).
//
// MİZANPAN: Abituriyent şəkli + tam oxunabilən məlumat SOLDA, nəticə inputları isə
//   şəklin SAĞINDA eyni sətirdə yerləşir — beləliklə operatorun scroll etməsinə
//   ehtiyac qalmır (1366×768).

import { useCallback, useEffect, useRef, useState } from "react";
import { useSetup } from "../context/SetupContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { PageHeader, Card, Spinner, EmptyState } from "../components/ui/Primitives.jsx";
import ExerciseInput from "../components/ExerciseInput.jsx";
import { fullName, genderLabel, formatDate, unitShort, parseMinSec, secondsToMinSecInput } from "../lib/format.js";

const blankInput = () => ({ rawValue: "", isRefused: false, notes: "" });

// Vahidə görə: input mətnini (operatorun gördüyü) DB üçün saniyəyə çevir.
// min_sec → "2.24" → 144 san. Digər vahidlər → birbaşa rəqəm.
// Yanlış formatda null qaytarır (çağıran tərəf xəta göstərir).
function inputToRaw(unit, text) {
  if (unit === "min_sec") return parseMinSec(text);
  const n = Number(text);
  return Number.isNaN(n) ? null : n;
}
// DB saniyəsini → input sahəsində göstəriləcək mətnə çevir.
function rawToInput(unit, raw) {
  if (raw === null || raw === undefined || raw === "") return "";
  if (unit === "min_sec") return secondsToMinSecInput(raw);   // 144 → "2.24"
  return raw;
}

// base64 (və ya hazır data URI) → <img src> üçün data URI
function toDataUri(b64) {
  if (!b64) return null;
  if (b64.startsWith("data:")) return b64;           // artıq tam data URI-dir
  let mime = "image/jpeg";                            // mime sniff (base64 başlanğıcı)
  if (b64.startsWith("iVBOR")) mime = "image/png";
  else if (b64.startsWith("R0lG")) mime = "image/gif";
  else if (b64.startsWith("UklG")) mime = "image/webp";
  return `data:${mime};base64,${b64}`;
}

function StudentPhoto({ studentId }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setLoading(true);
    if (!studentId) { setLoading(false); return; }
    api.get(`/students/${studentId}/photo`)
      .then((data) => { if (!cancelled) setSrc(toDataUri(data?.photo)); })
      .catch(()    => { if (!cancelled) setSrc(null); })
      .finally(()  => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId]);

  if (loading) {
    return <div className="w-48 h-60 rounded-soft bg-ink-100 border border-ink-200 animate-pulse" />;
  }
  if (!src) {
    return (
      <div className="w-48 h-60 rounded-soft bg-ink-100 border border-ink-200 flex items-center justify-center text-ink-300 text-xs text-center px-2">
        Şəkil yoxdur
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="Abituriyent şəkli"
      className="w-48 h-60 object-cover rounded-soft border border-ink-200 bg-ink-50"
    />
  );
}

function EditPasswordModal({ open, busy, error, onConfirm, onCancel }) {
  const [pw, setPw] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (open) { setPw(""); setTimeout(() => ref.current?.focus(), 50); } }, [open]);
  if (!open) return null;
  const submit = () => { if (pw) onConfirm(pw); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="w-full max-w-sm bg-paper border border-ink-200 rounded-soft shadow-deep p-6">
        <h3 className="font-display text-xl text-ink-900">Redaktə parolu</h3>
        <p className="text-sm text-ink-600 mt-1">Kilidli qeydi dəyişmək üçün redaktə parolunu daxil edin.</p>
        <input
          ref={ref}
          type="password"
          className="field mt-4"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder="••••••"
        />
        {error && <div className="text-sm text-rust-600 mt-2">{error}</div>}
        <div className="mt-5 flex justify-end gap-3">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Ləğv et</button>
          <button className="btn-primary px-6" onClick={submit} disabled={busy || !pw}>
            {busy ? "Yoxlanılır..." : "Aç"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorkstationPage() {
  const { setup } = useSetup();
  const { user } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState("result");   // "result" | "appeal"
  const [sNomer, setSNomer] = useState("");
  const [student, setStudent] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Nəticə vəziyyəti
  const [inputs, setInputs] = useState({});
  const [meta, setMeta] = useState({});
  // Apellyasiya vəziyyəti
  const [appealInputs, setAppealInputs] = useState({});
  const [appealMeta, setAppealMeta] = useState({});
  // Apellyasiya seçimi: { [exId]: null | "unchanged" | "changed" }
  const [appealDecisions, setAppealDecisions] = useState({});

  const [savingEx, setSavingEx] = useState(null);

  const [unlocked, setUnlocked] = useState(false);
  const editPwRef = useRef(null);
  const [pwModal, setPwModal] = useState({ open: false, busy: false, error: "" });
  const pwResolver = useRef(null);

  const sNomerRef = useRef(null);
  useEffect(() => { sNomerRef.current?.focus(); }, []);

  const initInputs = useCallback((existing = []) => {
    const ri = {}, rm = {}, ai = {}, am = {};
    for (const ex of setup.exercises) {
      const found = existing.find(r => r.exercise_id === ex.id);
      if (found) {
        ri[ex.id] = {
          rawValue: found.is_refused ? "" : rawToInput(ex.unit, found.raw_value),
          isRefused: !!found.is_refused,
          notes: found.notes ?? "",
        };
        rm[ex.id] = { resultId: found.id, locked: true, saved: true };

        const hasAppeal = found.appeal_value != null || !!found.appeal_is_refused;
        ai[ex.id] = {
          rawValue: found.appeal_is_refused ? "" : rawToInput(ex.unit, found.appeal_value),
          isRefused: !!found.appeal_is_refused,
          notes: found.appeal_notes ?? "",
        };
        am[ex.id] = { resultId: found.id, locked: hasAppeal, saved: hasAppeal };
      } else {
        ri[ex.id] = blankInput();  rm[ex.id] = { resultId: null, locked: false, saved: false };
        ai[ex.id] = blankInput();  am[ex.id] = { resultId: null, locked: false, saved: false };
      }
    }
    setInputs(ri); setMeta(rm);
    setAppealInputs(ai); setAppealMeta(am);
    setAppealDecisions({});
  }, [setup.exercises]);

  const lookupStudent = async () => {
    if (!sNomer) return toast.warn("Qol nömrəsi daxil edin");
    setLoadingStudent(true);
    setStudent(null);
    setUnlocked(false);
    editPwRef.current = null;
    try {
      const s = await api.get(
        `/students/lookup?examId=${setup.exam.id}&sNomer=${sNomer}`
      );
      const existing = await api.get(`/students/${s.id}/results`);
      setStudent(s);
      initInputs(existing);
      if (existing.length > 0) {
        const ap = existing.filter(r => r.appeal_value != null || r.appeal_is_refused).length;
        toast.info(`Bu Abituriyentin ${existing.length} nəticəsi mövcuddur${ap ? ` · ${ap} apellyasiya` : ""}`);
      }
    } catch (err) {
      toast.error(err.message);
      setSNomer("");
      sNomerRef.current?.focus();
    } finally {
      setLoadingStudent(false);
    }
  };

  const onSNomerKey = (e) => { if (e.key === "Enter") { e.preventDefault(); lookupStudent(); } };

  // Aktiv rejimin state-ləri
  const activeInputs = mode === "appeal" ? appealInputs : inputs;
  const activeMeta = mode === "appeal" ? appealMeta : meta;
  const setActiveInput = (exId, patch) => {
    if (mode === "appeal") setAppealInputs(p => ({ ...p, [exId]: { ...p[exId], ...patch } }));
    else setInputs(p => ({ ...p, [exId]: { ...p[exId], ...patch } }));
  };

  // ── parol açma ──
  const ensureUnlocked = () => new Promise((resolve) => {
    if (unlocked && editPwRef.current) return resolve(true);
    pwResolver.current = resolve;
    setPwModal({ open: true, busy: false, error: "" });
  });
  const confirmPw = async (password) => {
    setPwModal(m => ({ ...m, busy: true, error: "" }));
    try {
      await api.post("/results/verify-edit-password", { password });
      editPwRef.current = password;
      setUnlocked(true);
      setPwModal({ open: false, busy: false, error: "" });
      pwResolver.current?.(true); pwResolver.current = null;
      toast.success("Redaktə açıldı");
    } catch (err) {
      setPwModal(m => ({ ...m, busy: false, error: err.message || "Parol yanlışdır" }));
    }
  };
  const cancelPw = () => {
    setPwModal({ open: false, busy: false, error: "" });
    pwResolver.current?.(false); pwResolver.current = null;
  };

  const validateInput = (ex, inp, label) => {
    if (!inp) return `${ex.name}: dəyər daxil edilməyib`;
    if (inp.isRefused) return null;
    if (inp.rawValue === "" || inp.rawValue === null) return `${ex.name}: ${label} daxil edin və ya imtina seçin`;
    if (ex.unit === "min_sec") {
      const sec = parseMinSec(inp.rawValue);
      if (sec === null) return `${ex.name}: format yanlışdır (dəqiqə.saniyə, məs. 2.24)`;
      return null;
    }
    const n = Number(inp.rawValue);
    if (Number.isNaN(n) || n < 0) return `${ex.name}: dəyər müsbət ədəd olmalıdır`;
    return null;
  };

  const focusNextUnsaved = (fromIndex) => {
    for (let i = fromIndex + 1; i < setup.exercises.length; i++) {
      const ex = setup.exercises[i];
      const m = activeMeta[ex.id];
      if (!(m?.locked && !unlocked)) {
        const slot = document.querySelectorAll(".workstation-grid > .exercise-slot")[i];
        slot?.querySelector("input[type=number]")?.focus();
        return;
      }
    }
  };

  const saveOne = async (ex, index) => {
    const inp = activeInputs[ex.id];
    const m = activeMeta[ex.id] || {};

    // ════════════ APELLYASIYA ════════════
    if (mode === "appeal") {
      const decision = appealDecisions[ex.id];
      if (!decision) return toast.warn(`${ex.name}: «Dəyişdi» və ya «Dəyişmədi» seçin`);

      let appealValue, appealIsRefused;
      if (decision === "changed") {
        const err = validateInput(ex, inp, "apellyasiya dəyəri");
        if (err) return toast.warn(err);
        appealValue     = inp.isRefused ? null : inputToRaw(ex.unit, inp.rawValue);
        appealIsRefused = !!inp.isRefused;
      } else {
        // "unchanged" → köhnə (əsas) nəticəni apellyasiya kimi saxla
        const main = inputs[ex.id] || {};
        const hasMain = main.isRefused || (main.rawValue !== "" && main.rawValue != null);
        if (!hasMain) return toast.warn(`${ex.name}: əsas nəticə yoxdur, «Dəyişmədi» seçilə bilməz`);
        appealValue     = main.isRefused ? null : inputToRaw(ex.unit, main.rawValue);
        appealIsRefused = !!main.isRefused;
      }

      // parol: yalnız "dəyişdi"də (və ya artıq kilidli apellyasiyanı yenidən yazanda)
      if (decision === "changed" || m.saved) {
        const ok = await ensureUnlocked(); if (!ok) return;
      }

      setSavingEx(ex.id);
      try {
        const r = await api.post("/results/appeal/single", {
          studentId: student.id,
          examId: setup.exam.id,
          exerciseId: ex.id,
          appealValue,
          appealIsRefused,
          appealNotes: inp.notes || null,
          recordedBy: user?.name || "operator",
          editPassword: editPwRef.current || undefined,
        });
        setAppealMeta(prev => ({ ...prev, [ex.id]: { resultId: r.result.id, locked: true, saved: true } }));
        toast.success(decision === "unchanged"
          ? `✓ ${ex.name} — nəticə dəyişmədi, köhnə nəticə saxlanıldı`
          : `✓ ${ex.name} — yeni apellyasiya nəticəsi saxlanıldı`);
        focusNextUnsaved(index);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setSavingEx(null);
      }
      return;
    }

    // ════════════ NƏTİCƏ ════════════
    const err = validateInput(ex, inp, "dəyər");
    if (err) return toast.warn(err);

    // Kilidli nəticəni yeniləmək üçün əvvəlcə parol
    if (m.saved && m.resultId) {
      const ok = await ensureUnlocked(); if (!ok) return;
    }

    setSavingEx(ex.id);
    try {
      let row;
      if (m.saved && m.resultId) {
        const r = await api.put(`/results/${m.resultId}`, {
          rawValue: inp.isRefused ? null : inputToRaw(ex.unit, inp.rawValue),
          isRefused: inp.isRefused,
          notes: inp.notes || null,
          editPassword: editPwRef.current,
          recordedBy: user?.name || "operator",
        });
        row = r.result;
        toast.success(`✓ ${ex.name} yeniləndi`);
      } else {
        const r = await api.post("/results/single", {
          studentId: student.id,
          examId: setup.exam.id,
          exerciseId: ex.id,
          rawValue: inp.isRefused ? null : inputToRaw(ex.unit, inp.rawValue),
          isRefused: inp.isRefused,
          notes: inp.notes || null,
          recordedBy: user?.name || "operator",
        });
        row = r.result;
        toast.success(`✓ ${ex.name} saxlanıldı və kilidləndi`);
      }
      setMeta(prev => ({ ...prev, [ex.id]: { resultId: row.id, locked: !!row.locked, saved: true } }));
      focusNextUnsaved(index);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingEx(null);
    }
  };

  // Yalnız Nəticə rejimində — hamısını birlikdə saxla
  const handleSaveAll = async () => {
    for (const ex of setup.exercises) {
      const err = validateInput(ex, inputs[ex.id], "dəyər");
      if (err) return toast.warn(err);
    }
    const hasLocked = setup.exercises.some(ex => meta[ex.id]?.locked);
    if (hasLocked) { const ok = await ensureUnlocked(); if (!ok) return; }

    setSavingAll(true);
    try {
      const items = setup.exercises.map(ex => ({
        studentId: student.id,
        examId: setup.exam.id,
        exerciseId: ex.id,
        rawValue: inputs[ex.id].isRefused ? null : inputToRaw(ex.unit, inputs[ex.id].rawValue),
        isRefused: !!inputs[ex.id].isRefused,
        notes: inputs[ex.id].notes || null,
      }));
      const result = await api.post("/results/bulk", {
        recordedBy: user?.name || "operator",
        editPassword: editPwRef.current || undefined,
        items,
      });
      toast.success(`✓ ${result.saved} nəticə saxlanıldı — ${fullName(student)}`);
      goNext();
    } catch (err) {
      toast.error("Saxlanılmadı: " + err.message);
    } finally {
      setSavingAll(false);
    }
  };

  const goNext = () => {
    const nextNo = (Number(sNomer) || 0) + 1;
    setStudent(null);
    setInputs({}); setMeta({}); setAppealInputs({}); setAppealMeta({});
    setAppealDecisions({});
    setUnlocked(false); editPwRef.current = null;
    setSNomer(String(nextNo));
    setTimeout(() => sNomerRef.current?.focus(), 100);
  };

  const exerciseCount = setup.exercises.length;
  const isAppeal = mode === "appeal";

  const refText = (ex) => {
    const r = inputs[ex.id];
    if (!r) return "—";
    if (r.isRefused) return "İmtina";
    if (r.rawValue === "" || r.rawValue == null) return "—";
    if (ex.unit === "min_sec") return r.rawValue;
    return `${r.rawValue} ${unitShort(ex.unit)}`;
  };

  return (
    <>
      

      {/* Rejim seçimi */}
      <div className="mb-4 inline-flex rounded-soft border border-ink-200 overflow-hidden">
        <button
          onClick={() => setMode("result")}
          className={`px-4 py-2 text-sm transition-colors ${!isAppeal ? "bg-moss-500 text-paper" : "bg-paper text-ink-600 hover:bg-ink-100"}`}
        >
          Nəticə
        </button>
        <button
          onClick={() => setMode("appeal")}
          className={`px-4 py-2 text-sm transition-colors ${isAppeal ? "bg-orange-500 text-paper" : "bg-paper text-ink-600 hover:bg-ink-100"}`}
        >
          Apellyasiya
        </button>
      </div>

      <Card title="Abituriyent axtarışı" subtitle="Qol nömrəsini daxil edin və Enter basın">
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="label">Qol №</label>
            <input
              ref={sNomerRef}
              type="number"
              value={sNomer}
              onChange={(e) => setSNomer(e.target.value)}
              onKeyDown={onSNomerKey}
              placeholder=""
              className="huge-input field"
              autoFocus
            />
          </div>
          <button className="btn-primary h-12 px-6" onClick={lookupStudent} disabled={loadingStudent}>
            {loadingStudent ? "Axtarılır..." : "Tap"}
          </button>
          {student && <button className="btn-ghost h-12" onClick={goNext}>Növbəti</button>}
        </div>
      </Card>

      {loadingStudent && <div className="mt-6"><Spinner label="Abituriyent axtarılır..." /></div>}

      {student && !loadingStudent && (
        <>
          {isAppeal && (
            <div className="mt-4 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-soft px-4 py-2">
              Apellyasiya rejimi — hər hərəkət üçün «Dəyişmədi» (köhnə nəticə saxlanılır) və ya «Dəyişdi» (yeni dəyər admin parolu ilə qeyd edilir) seçin.
            </div>
          )}

          <Card className="mt-4" title="Abituriyent məlumatı"
                subtitle={`İş №: ${student.is_n} · Sıra: ${student.s_nomer}`}>
            <div className="flex flex-col xl:flex-row gap-6 items-start">

              {/* SOL BLOK — şəkil + məlumat */}
              <div className="flex gap-5 items-start shrink-0">
                <StudentPhoto studentId={student.id} />
                <div className="grid grid-cols-1 gap-3 text-sm min-w-[220px]">
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
                  <div>
                    <div className="text-ink-400 text-xs uppercase">Komissiya</div>
                    <div className="font-medium text-ink-900 mt-0.5">№{student.commission_no}</div>
                  </div>
                </div>
              </div>

              {/* SAĞ BLOK — nəticə inputları (şəklin sağında) */}
              <div className="flex-1 min-w-0 w-full">
                <div className="workstation-grid grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {setup.exercises.map((ex, i) => (
                    <div key={ex.id} className="exercise-slot">
                      <ExerciseInput
                        exercise={ex}
                        index={i}
                        total={exerciseCount}
                        value={activeInputs[ex.id]?.rawValue ?? ""}
                        isRefused={activeInputs[ex.id]?.isRefused ?? false}
                        notes={activeInputs[ex.id]?.notes ?? ""}
                        saved={activeMeta[ex.id]?.saved ?? false}
                        locked={activeMeta[ex.id]?.locked ?? false}
                        unlocked={unlocked}
                        saving={savingEx === ex.id}
                        autoFocus={i === 0}
                        appeal={isAppeal}
                        referenceText={isAppeal ? refText(ex) : null}
                        appealDecision={isAppeal ? (appealDecisions[ex.id] ?? null) : null}
                        onAppealDecisionChange={(d) => setAppealDecisions(p => ({ ...p, [ex.id]: d }))}
                        onChange={(v)        => setActiveInput(ex.id, { rawValue: v })}
                        onRefuseChange={(v)  => setActiveInput(ex.id, { isRefused: v })}
                        onNotesChange={(v)   => setActiveInput(ex.id, { notes: v })}
                        onSave={()           => saveOne(ex, i)}
                        onRequestEdit={()    => ensureUnlocked()}
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </Card>
        </>
      )}

      {!student && !loadingStudent && (
        <Card className="mt-6">
          <EmptyState icon="◯" title="Abituriyent seçilməyib" hint="Yuxarıda qol nömrəsini daxil edib Enter basın" />
        </Card>
      )}

      <EditPasswordModal
        open={pwModal.open}
        busy={pwModal.busy}
        error={pwModal.error}
        onConfirm={confirmPw}
        onCancel={cancelPw}
      />
    </>
  );
}