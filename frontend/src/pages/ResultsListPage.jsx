
import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { PageHeader, Card, Spinner, EmptyState, Toolbar } from "../components/ui/Primitives.jsx";
import { fullName, formatRaw } from "../lib/format.js";
import { useSetup } from "../context/SetupContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function ResultsListPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { setup } = useSetup();

  const [exams, setExams] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [examId, setExamId] = useState(setup.exam?.id ? String(setup.exam.id) : "");
  const [commissionNo, setCommissionNo] = useState(setup.commission?.commission_no || "");
  const [search, setSearch] = useState("");

  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);

  // İmtahan/komissiya siyahıları yalnız admin filtri üçün lazımdır.
  useEffect(() => {
    if (!isAdmin) return;
    api.get("/exams").then(setExams).catch(err => toast.error(err.message));
    api.get("/commissions").then(setCommissions).catch(err => toast.error(err.message));
  }, [isAdmin]);

  // Admin deyilsə: imtahanı quraşdırmadakı seçimə kilidlə, komissiya filtrini sıfırla.
  useEffect(() => {
    if (isAdmin) return;
    setExamId(setup.exam?.id ? String(setup.exam.id) : "");
    setCommissionNo("");
  }, [isAdmin, setup.exam?.id]);

  useEffect(() => {
    if (!examId) { setStudents([]); setResults([]); setExercises([]); return; }
    setLoading(true);
    const sParam = commissionNo ? `&commissionNo=${commissionNo}` : "";
    Promise.all([
      api.get(`/students?examId=${examId}${sParam}`),
      api.get(`/results?examId=${examId}${sParam}`),
    ])
      .then(([st, rs]) => {
        setStudents(st);
        setResults(rs);
        const exMap = new Map();
        for (const r of rs) {
          if (!exMap.has(r.exercise_id)) {
            exMap.set(r.exercise_id, {
              id: r.exercise_id,
              code: r.exercise_code,
              name: r.exercise_name,
              unit: r.unit,
            });
          }
        }
        setExercises([...exMap.values()].sort((a, b) => a.id - b.id));
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [examId, commissionNo]);

  const lookup = useMemo(() => {
    const m = new Map();
    for (const r of results) m.set(`${r.student_id}-${r.exercise_id}`, r);
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

  const stats = useMemo(() => {
    const total = students.length * exercises.length;
    const filled = results.length;
    const appealed = results.filter(r => r.appeal_value != null || r.appeal_is_refused).length;
    return {
      students: students.length,
      exercises: exercises.length,
      cells: total,
      filled,
      appealed,
      pct: total > 0 ? Math.round((filled / total) * 100) : 0,
    };
  }, [students, exercises, results]);

  const exportUrl = examId
    ? `/exports/results.xlsx?examId=${examId}${commissionNo ? `&commissionNo=${commissionNo}` : ""}`
    : null;

  const selectedExamLabel = setup.exam?.name
    ? `${setup.exam.name}${setup.exam.exam_date ? ` (${setup.exam.exam_date})` : ""}`
    : "—";

  return (
    <>
      <PageHeader title="Yığılmış nəticələr" />

      <Toolbar>
        {isAdmin ? (
          <>
            <div>
              <label className="label-inline">İmtahan</label>
              <select value={examId} onChange={(e) => setExamId(e.target.value)} className="field !w-auto">
                <option value="">— Seçin —</option>
                {exams.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.exam_date})</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          // Stansiya rejimi: imtahan dəyişdirilə bilməz, yalnız seçilmiş imtahan göstərilir.
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

        {examId && (
          <button
            className="btn-primary self-end"
            onClick={() => api.download(exportUrl, `results_exam${examId}.xlsx`)}
          >
            Excel ixrac
          </button>
        )}
      </Toolbar>

      {examId && (
        <div className="mb-3 flex items-center gap-3 text-xs text-ink-600">
          <span><strong>{stats.students}</strong> Abituriyent · <strong>{stats.exercises}</strong> hərəkət</span>
          <span className="px-2 py-0.5 rounded bg-moss-100 text-moss-700">
            {stats.filled}/{stats.cells} ({stats.pct}%)
          </span>
          {stats.appealed > 0 && (
            <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-300">
              {stats.appealed} apellyasiya
            </span>
          )}
        </div>
      )}

      {loading ? <Spinner /> : !examId ? (
        <Card>
          <EmptyState
            title={isAdmin ? "İmtahan seçin" : "İmtahan təyin olunmayıb"}
            hint={isAdmin ? "Yuxarıdakı filtrlərdən istifadə edin" : "Stansiya quraşdırmasında imtahan seçilməlidir"}
          />
        </Card>
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
                {exercises.map(ex => (
                  <th key={ex.id} className="px-3 py-2 text-left whitespace-nowrap">
                    <div className="font-mono text-xs text-ink-400">{ex.code}</div>
                    <div>{ex.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(s => (
                <tr key={s.id} className="border-t border-ink-100 hover:bg-paper-100/60">
                  <td className="px-3 py-2 font-mono">{s.s_nomer ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.is_n}</td>
                  <td className="px-3 py-2">{fullName(s)}</td>
                  <td className="px-3 py-2 font-mono">{s.commission_no}</td>
                  {exercises.map(ex => {
                    const r = lookup.get(`${s.id}-${ex.id}`);
                    if (!r) return <td key={ex.id} className="px-3 py-2 text-ink-300">—</td>;

                    const hasAppeal = r.appeal_value != null || r.appeal_is_refused;

                    if (!hasAppeal) {
                      if (r.is_refused) return (
                        <td key={ex.id} className="px-3 py-2">
                          <span className="px-2 py-0.5 text-xs rounded bg-rust-500 text-paper">İmtina</span>
                        </td>
                      );
                      return (
                        <td key={ex.id} className="px-3 py-2">
                          <span className="font-mono">{formatRaw(r.raw_value, ex.unit)}</span>
                          {r.notes && <div className="text-xs text-ink-400">ⓘ {r.notes}</div>}
                        </td>
                      );
                    }

                    // Apellyasiya var → narıncı, altında əsas nəticə üstüçızıqlı
                    const baseText = r.is_refused ? "İmtina" : formatRaw(r.raw_value, ex.unit);
                    return (
                      <td key={ex.id} className="px-3 py-2">
                        {r.appeal_is_refused ? (
                          <span className="px-2 py-0.5 text-xs rounded bg-orange-500 text-paper" title="Apellyasiya">İmtina (apel.)</span>
                        ) : (
                          <span className="font-mono font-semibold text-orange-600" title="Apellyasiya qiyməti">
                            {formatRaw(r.appeal_value, ex.unit)}
                          </span>
                        )}
                        <div className="text-[11px] text-ink-300 line-through" title="Əsas nəticə">{baseText}</div>
                        {r.appeal_notes && <div className="text-xs text-orange-500">⚖ {r.appeal_notes}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}