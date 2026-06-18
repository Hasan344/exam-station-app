// src/pages/ExpertWorkstationPage.jsx
//
// SECTION 3 — Ekspert bazlı iş səhifəsi.
//
// Operator sıra № (s_nomer) daxil edir → tələbə tapılır → imtahanın HƏR ekspertinə
// görə bir input açılır (0–100 tam ədəd) → hər biri ayrıca və ya "Hamısını saxla"
// ilə saxlanılır. Saxlanan bal kilidlənir; dəyişmək üçün redaktə parolu tələb olunur
// (results.js / student_exam_results ilə eyni məntiq).
//
// İmtina ayrıca toggle DEYİL — imtina halında operator sadəcə 0 yazır.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSetup } from "../context/SetupContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { PageHeader, Card, Spinner, EmptyState } from "../components/ui/Primitives.jsx";
import ExpertScoreInput from "../components/ExpertScoreInput.jsx";
import { fullName, genderLabel, formatDate } from "../lib/format.js";

// ─────────── Redaktə parolu modalı ───────────
function PasswordModal({ open, busy, error, onConfirm, onCancel }) {
  const [pw, setPw] = useState("");
  useEffect(() => { if (open) setPw(""); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/50 p-4">
      <div className="card w-full max-w-sm p-5">
        <h3 className="font-display text-lg mb-1">Redaktə parolu</h3>
        <p className="text-sm text-ink-500 mb-3">Bu bal kilidlidir. Dəyişmək üçün redaktə parolunu daxil edin.</p>
        <input
          type="password"
          className="field"
          value={pw}
          autoFocus
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onConfirm(pw); }}
        />
        {error && <div className="text-sm text-rust-600 mt-2">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Ləğv et</button>
          <button className="btn-primary" onClick={() => onConfirm(pw)} disabled={busy}>
            {busy ? "Yoxlanılır..." : "Aç"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExpertWorkstationPage() {
  const { setup } = useSetup();
  const { user } = useAuth();
  const toast = useToast();

  const [experts, setExperts] = useState([]);
  const [loadingExperts, setLoadingExperts] = useState(true);

  const [sNomer, setSNomer] = useState("");
  const [student, setStudent] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // { [expertId]: { score: string } }
  const [inputs, setInputs] = useState({});
  // { [expertId]: { resultId, locked, saved } }
  const [meta, setMeta] = useState({});
  const [savingExpert, setSavingExpert] = useState(null);
  const [savingAll, setSavingAll] = useState(false);

  // Redaktə parolu
  const [unlocked, setUnlocked] = useState(false);
  const editPwRef = useRef(null);
  const [pwModal, setPwModal] = useState({ open: false, busy: false, error: "" });
  const pwResolver = useRef(null);

  const sNomerRef = useRef(null);
  useEffect(() => { sNomerRef.current?.focus(); }, []);

  // İmtahanın ekspertlərini yüklə
  useEffect(() => {
    if (!setup.exam?.id) return;
    setLoadingExperts(true);
    api.get(`/expert-results/exam/${setup.exam.id}/experts`)
      .then(setExperts)
      .catch(err => toast.error("Ekspertlər yüklənmədi: " + err.message))
      .finally(() => setLoadingExperts(false));
  }, [setup.exam?.id]);

  const initInputs = useCallback((existing = []) => {
    const ri = {}, rm = {};
    for (const ex of experts) {
      const found = existing.find(r => r.expert_id === ex.id);
      if (found) {
        ri[ex.id] = { score: found.score != null ? String(found.score) : "" };
        rm[ex.id] = { resultId: found.id, locked: true, saved: true };
      } else {
        ri[ex.id] = { score: "" };
        rm[ex.id] = { resultId: null, locked: false, saved: false };
      }
    }
    setInputs(ri);
    setMeta(rm);
  }, [experts]);

  const lookupStudent = async () => {
    if (!sNomer) return toast.warn("Sıra nömrəsi daxil edin");
    if (experts.length === 0) return toast.warn("Bu imtahana ekspert təyin olunmayıb");
    setLoadingStudent(true);
    setStudent(null);
    setUnlocked(false);
    editPwRef.current = null;
    try {
      const s = await api.get(`/students/lookup?examId=${setup.exam.id}&sNomer=${sNomer}`);
      const existing = await api.get(`/expert-results/student/${s.id}`);
      setStudent(s);
      initInputs(existing);
      if (existing.length > 0) {
        toast.info(`Bu tələbənin ${existing.length} ekspert balı mövcuddur`);
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

  const setScore = (expertId, val) => {
    setInputs(p => ({ ...p, [expertId]: { ...p[expertId], score: val } }));
  };

  const validateScore = (ex, inp) => {
    if (!inp || inp.score === "" || inp.score == null) {
      return `${ex.name}: bal daxil edin (0–100)`;
    }
    const n = Number(inp.score);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      return `${ex.name}: bal 0–100 arası tam ədəd olmalıdır`;
    }
    return null;
  };

  const saveOne = async (ex) => {
    const inp = inputs[ex.id];
    const m = meta[ex.id] || {};
    const err = validateScore(ex, inp);
    if (err) return toast.warn(err);

    // Kilidli balı yenidən yazmaq üçün əvvəlcə parol
    if (m.saved && m.resultId) {
      const ok = await ensureUnlocked(); if (!ok) return;
    }

    setSavingExpert(ex.id);
    try {
      const r = await api.post("/expert-results/single", {
        studentId: student.id,
        examId: setup.exam.id,
        expertId: ex.id,
        score: Number(inp.score),
        recordedBy: user?.name || "operator",
        editPassword: editPwRef.current || undefined,
      });
      setMeta(prev => ({ ...prev, [ex.id]: { resultId: r.result.id, locked: !!r.result.locked, saved: true } }));
      toast.success(`✓ ${ex.name} balı saxlanıldı`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingExpert(null);
    }
  };

  const handleSaveAll = async () => {
    for (const ex of experts) {
      const err = validateScore(ex, inputs[ex.id]);
      if (err) return toast.warn(err);
    }
    const hasLocked = experts.some(ex => meta[ex.id]?.locked);
    if (hasLocked) { const ok = await ensureUnlocked(); if (!ok) return; }

    setSavingAll(true);
    try {
      // /single endpointini hər ekspert üçün ardıcıl çağırırıq (bulk endpoint yoxdur).
      for (const ex of experts) {
        const r = await api.post("/expert-results/single", {
          studentId: student.id,
          examId: setup.exam.id,
          expertId: ex.id,
          score: Number(inputs[ex.id].score),
          recordedBy: user?.name || "operator",
          editPassword: editPwRef.current || undefined,
        });
        setMeta(prev => ({ ...prev, [ex.id]: { resultId: r.result.id, locked: !!r.result.locked, saved: true } }));
      }
      toast.success(`✓ ${experts.length} ekspert balı saxlanıldı — ${fullName(student)}`);
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
    setInputs({}); setMeta({});
    setUnlocked(false); editPwRef.current = null;
    setSNomer(String(nextNo));
    setTimeout(() => sNomerRef.current?.focus(), 100);
  };

  // Canlı orta bal (yalnız doldurulmuş ballar üzərindən; imtina = 0 onsuz da daxildir)
  const filledScores = experts
    .map(ex => inputs[ex.id]?.score)
    .filter(v => v !== "" && v != null)
    .map(Number);
  const liveAvg = filledScores.length
    ? (filledScores.reduce((a, b) => a + b, 0) / filledScores.length)
    : null;

  return (
    <>
      <PageHeader title="Ekspert qiymətləndirməsi" subtitle={setup.exam?.name} />

      {/* Sıra № axtarışı */}
      <Card className="mb-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="label">Sıra № (s_nomer)</label>
            <input
              ref={sNomerRef}
              type="text"
              inputMode="numeric"
              className="field text-lg"
              value={sNomer}
              onChange={(e) => setSNomer(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={onSNomerKey}
              placeholder="məs. 1"
            />
          </div>
          <button className="btn-primary" onClick={lookupStudent} disabled={loadingStudent}>
            {loadingStudent ? "Axtarılır..." : "Tap"}
          </button>
        </div>
      </Card>

      {loadingExperts ? (
        <Spinner />
      ) : experts.length === 0 ? (
        <Card>
          <EmptyState
            title="Ekspert təyin olunmayıb"
            hint="Bu imtahana exam_expert_subprofession vasitəsilə ekspert idxal edilməlidir"
          />
        </Card>
      ) : !student ? (
        <Card>
          <EmptyState title="Tələbə seçilməyib" hint="Sıra nömrəsi daxil edib «Tap» düyməsini basın" />
        </Card>
      ) : (
        <Card title="Abituriyent məlumatı" subtitle={`İş №: ${student.is_n} · Sıra: ${student.s_nomer}`}>
          <div className="flex flex-col xl:flex-row gap-6 items-start">

            {/* SOL — məlumat */}
            <div className="grid grid-cols-1 gap-3 text-sm min-w-[220px] shrink-0">
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
              {liveAvg != null && (
                <div className="mt-2 px-3 py-2 rounded-soft bg-moss-100 text-moss-800">
                  <span className="text-xs uppercase">Orta bal</span>
                  <div className="text-2xl font-semibold tabular-nums">{liveAvg.toFixed(2)}</div>
                </div>
              )}
            </div>

            {/* SAĞ — ekspert inputları */}
            <div className="flex-1 min-w-0 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {experts.map((ex) => {
                  const m = meta[ex.id] || {};
                  const readOnly = m.locked && !unlocked;
                  return (
                    <div key={ex.id} className={`card p-4 ${readOnly ? "bg-ink-100/60 border-ink-300" : ""}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-ink-900 truncate">{ex.name}</div>
                        {m.saved && (
                          <span className="text-xs px-2 py-0.5 rounded border bg-moss-400/20 text-moss-700 border-moss-400/40">
                            kilidli
                          </span>
                        )}
                      </div>
                      <ExpertScoreInput
                        value={inputs[ex.id]?.score ?? ""}
                        onChange={(v) => setScore(ex.id, v)}
                        disabled={readOnly}
                        onEnter={() => saveOne(ex)}
                      />
                      <button
                        className="btn-primary w-full mt-2 text-sm"
                        onClick={() => saveOne(ex)}
                        disabled={savingExpert === ex.id || savingAll}
                      >
                        {savingExpert === ex.id ? "Saxlanılır..." : m.saved ? "Yenilə" : "Saxla"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end mt-4">
                <button className="btn-primary px-6" onClick={handleSaveAll} disabled={savingAll}>
                  {savingAll ? "Saxlanılır..." : "Hamısını saxla → növbəti"}
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <PasswordModal
        open={pwModal.open}
        busy={pwModal.busy}
        error={pwModal.error}
        onConfirm={confirmPw}
        onCancel={cancelPw}
      />
    </>
  );
}
