// src/pages/ExpertResultsPage.jsx
//
// SECTION 3 — Ekspert nəticələri görünüşü.
//
// Sətir = tələbə, sütun = hər ekspert (yazdığı bal), sonda "Orta bal" sütunu.
// Orta bal = doldurulmuş ekspert ballarının ədədi ortası (imtina = 0 onsuz da daxildir).

import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { PageHeader, Card, Spinner, EmptyState, Toolbar } from "../components/ui/Primitives.jsx";
import { fullName } from "../lib/format.js";
import { useSetup } from "../context/SetupContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function ExpertResultsPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { setup } = useSetup();

  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState(setup.exam?.id ? String(setup.exam.id) : "");
  const [search, setSearch] = useState("");

  const [experts, setExperts] = useState([]);
  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Admin filtri üçün imtahan siyahısı
  useEffect(() => {
    if (!isAdmin) return;
    api.get("/exams").then(setExams).catch(err => toast.error(err.message));
  }, [isAdmin]);

  // Station rejimi: imtahanı quraşdırmadakı seçimə kilidlə
  useEffect(() => {
    if (isAdmin) return;
    setExamId(setup.exam?.id ? String(setup.exam.id) : "");
  }, [isAdmin, setup.exam?.id]);

  useEffect(() => {
    if (!examId) { setExperts([]); setStudents([]); setResults([]); return; }
    setLoading(true);
    Promise.all([
      api.get(`/expert-results/exam/${examId}/experts`),
      api.get(`/students?examId=${examId}`),
      api.get(`/expert-results?examId=${examId}`),
    ])
      .then(([ex, st, rs]) => {
        setExperts(ex);
        setStudents(st);
        setResults(rs);
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [examId]);

  // (student_id, expert_id) → row
  const lookup = useMemo(() => {
    const m = new Map();
    for (const r of results) m.set(`${r.student_id}-${r.expert_id}`, r);
    return m;
  }, [results]);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(s =>
      (s.surname || "").toLowerCase().includes(q) ||
      (s.name || "").toLowerCase().includes(q) ||
      (s.father_name || "").toLowerCase().includes(q) ||
      (s.is_n || "").toLowerCase().includes(q) ||
      String(s.s_nomer || "").includes(q)
    );
  }, [students, search]);

  // Tələbənin orta balı (doldurulmuş ballar üzərindən)
  const avgFor = (studentId) => {
    const vals = experts
      .map(ex => lookup.get(`${studentId}-${ex.id}`))
      .filter(r => r && r.score != null)
      .map(r => Number(r.score));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const selectedExamLabel = setup.exam?.name
    ? `${setup.exam.name}${setup.exam.exam_date ? ` (${setup.exam.exam_date})` : ""}`
    : "—";

  return (
    <>
      <PageHeader title="Ekspert nəticələri" />

      <Toolbar>
        {isAdmin ? (
          <div>
            <label className="label-inline">İmtahan</label>
            <select value={examId} onChange={(e) => setExamId(e.target.value)} className="field !w-auto">
              <option value="">— Seçin —</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.exam_date})</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label-inline">İmtahan</label>
            <div className="field !w-auto bg-ink-100/60 text-ink-700 font-medium">
              {selectedExamLabel}
            </div>
          </div>
        )}

        <div className="flex-1">
          <label className="label-inline">Axtarış</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, soyad, iş №..." className="field" />
        </div>
      </Toolbar>

      {examId && (
        <div className="mb-3 flex items-center gap-3 text-xs text-ink-600">
          <span><strong>{students.length}</strong> Abituriyent · <strong>{experts.length}</strong> ekspert</span>
        </div>
      )}

      {loading ? <Spinner /> : !examId ? (
        <Card>
          <EmptyState
            title={isAdmin ? "İmtahan seçin" : "İmtahan təyin olunmayıb"}
            hint={isAdmin ? "Yuxarıdakı filtrlərdən istifadə edin" : "Stansiya quraşdırmasında imtahan seçilməlidir"}
          />
        </Card>
      ) : experts.length === 0 ? (
        <Card><EmptyState title="Ekspert tapılmadı" hint="Bu imtahana ekspert təyin olunmayıb" /></Card>
      ) : filteredStudents.length === 0 ? (
        <Card><EmptyState title="Abituriyent tapılmadı" hint="Filtrləri yumşaldıb yenidən cəhd edin" /></Card>
      ) : (
        <div className="overflow-x-auto card">
          <table className="min-w-full text-sm">
            <thead className="bg-paper-100 border-b border-ink-200">
              <tr>
                <th className="px-3 py-2 text-left">№</th>
                <th className="px-3 py-2 text-left">İş №</th>
                <th className="px-3 py-2 text-left">Soyad Ad Ata</th>
                <th className="px-3 py-2 text-left">Kom.</th>
                {experts.map(ex => (
                  <th key={ex.id} className="px-3 py-2 text-center whitespace-nowrap">{ex.name}</th>
                ))}
                <th className="px-3 py-2 text-center bg-moss-100 text-moss-800">Orta bal</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(s => {
                const avg = avgFor(s.id);
                return (
                  <tr key={s.id} className="border-t border-ink-100 hover:bg-paper-100/60">
                    <td className="px-3 py-2 font-mono">{s.s_nomer ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.is_n}</td>
                    <td className="px-3 py-2">{fullName(s)}</td>
                    <td className="px-3 py-2 font-mono">{s.commission_no}</td>
                    {experts.map(ex => {
                      const r = lookup.get(`${s.id}-${ex.id}`);
                      return (
                        <td key={ex.id} className="px-3 py-2 text-center tabular-nums">
                          {r && r.score != null
                            ? <span className="font-semibold">{r.score}</span>
                            : <span className="text-ink-300">—</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center bg-moss-50 font-semibold tabular-nums">
                      {avg != null ? avg.toFixed(2) : <span className="text-ink-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
