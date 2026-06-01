// src/pages/ResultsListPage.jsx
//
// Yığılmış nəticələrin matris baxışı:
//   • Sətirlər: tələbələr (sıra № üzrə)
//   • Sütunlar: hərəkətlər
//   • Hər xanada raw_value (və ya "İmtina")
//
// Filter: İmtahan + Komissiya. Axtarış: ad/soyad/iş №.

import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { PageHeader, Card, Spinner, EmptyState, Toolbar } from "../components/ui/Primitives.jsx";
import { fullName, formatRaw } from "../lib/format.js";

export default function ResultsListPage() {
  const toast = useToast();

  const [exams, setExams] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [examId, setExamId] = useState("");
  const [commissionNo, setCommissionNo] = useState("");
  const [search, setSearch] = useState("");

  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);    // bütün nəticələr (filtirli)
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);

  // İmtahan + komissiya siyahıları
  useEffect(() => {
    api.get("/exams").then(setExams).catch(err => toast.error(err.message));
    api.get("/commissions").then(setCommissions).catch(err => toast.error(err.message));
  }, []);

  // Filter dəyişəndə data yüklə
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
        // bu data dəstində istifadə olunan hərəkətləri tap
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

  // student_id × exercise_id → result lookup
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
    return {
      students: students.length,
      exercises: exercises.length,
      cells: total,
      filled,
      pct: total > 0 ? Math.round((filled / total) * 100) : 0,
    };
  }, [students, exercises, results]);

  return (
    <>
      <PageHeader title="Yığılmış nəticələr" subtitle="Komissiya × hərəkət matrisi" />

      <Toolbar>
        <div>
          <label className="label-inline">İmtahan</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)} className="field !w-auto">
            <option value="">— Seçin —</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.exam_date})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-inline">Komissiya</label>
          <select value={commissionNo} onChange={(e) => setCommissionNo(e.target.value)} className="field !w-auto">
            <option value="">— Hamısı —</option>
            {commissions.map(c => (
              <option key={c.id} value={c.commission_no}>№{c.commission_no} — {c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="label-inline">Axtarış</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, soyad, iş №..." className="field" />
        </div>

        {examId && (
          <div className="text-xs text-ink-600 ml-auto">
            <strong>{stats.students}</strong> tələbə · <strong>{stats.exercises}</strong> hərəkət
            <span className="ml-2 px-2 py-0.5 rounded bg-moss-100 text-moss-700">
              {stats.filled}/{stats.cells} ({stats.pct}%)
            </span>
          </div>
        )}
      </Toolbar>

      {loading ? <Spinner /> : !examId ? (
        <Card>
          <EmptyState title="İmtahan seçin" hint="Yuxarıdakı filtrlərdən istifadə edin" />
        </Card>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <EmptyState title="Tələbə tapılmadı" hint="Filtrləri yumşaldıb yenidən cəhd edin" />
        </Card>
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
