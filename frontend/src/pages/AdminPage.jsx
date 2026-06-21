// src/pages/AdminPage.jsx
//
// Admin paneli — 4 tab:
//   • İdxal      → ResultsApp-dan idxal (URL) + Snapshot JSON faylı idxalı
//   • İmtahan    → CRUD: imtahan əlavə et / sil
//   • Eksport    → nəticələri xlsx/json/csv kimi yüklə
//   • Parol      → admin parolunu dəyiş

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { PageHeader, Card, EmptyState } from "../components/ui/Primitives.jsx";
import ResultEditPasswordCard from "../components/ResultEditPasswordCard.jsx";
const TABS = [
  { id: "import",   label: "İdxal" },
  { id: "exam",     label: "İmtahanlar" },
  { id: "export",   label: "Eksport" },
  { id: "password", label: "Parol" },
];

export default function AdminPage() {
  const [tab, setTab] = useState("import");
  return (
    <>
      <PageHeader title="Admin panel" subtitle="İdarəetmə əməliyyatları" />

      {/* Tab-lar birbaşa gradient fon üzərində render olunur → ağ mətn/sərhəd */}
      <div className="flex gap-1 mb-6 border-b border-white/20">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors
              ${tab === t.id
                ? "border-white text-white font-medium"
                : "border-transparent text-white/60 hover:text-white"}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === "import"   && <ImportTab />}
      {tab === "exam"     && <ExamTab />}
      {tab === "export"   && <ExportTab />}
      {tab === "password" && <PasswordTab />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  IDXAL
//  İki yol:
//    1) ResultsApp-dan birbaşa (URL)
//    2) Lokal snapshot JSON faylı (hamısı bir dəfəyə)
// ─────────────────────────────────────────────────────────────
function ImportTab() {
  return (
    <div className="space-y-6">
      <SnapshotJsonImportCard />
      <ResultsAppImportCard />
    </div>
  );
}

// Cədvəl-cədvəl hesabat bloku (ResultsApp və JSON idxalı üçün ortaq).
function ImportReport({ report }) {
  if (!report) return null;
  return (
    <div className="mt-3 text-xs">
      <div className="text-ink-700 font-medium">{report.message}</div>
      <details className="mt-2">
        <summary className="cursor-pointer text-ink-600">Cədvəl-cədvəl detallar</summary>
        <ul className="mt-1 space-y-1">
          {Object.entries(report.reports).map(([table, rep]) => (
            <li key={table} className="bg-ink-50 border border-ink-200 rounded p-2">
              <div className="flex justify-between">
                <span className="font-medium">{table}</span>
                <span className="text-ink-600">
                  ✔ {rep.inserted} {rep.failed > 0 && <span className="text-rust-600">/ ✗ {rep.failed}</span>}
                </span>
              </div>
              {rep.errors?.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-rust-600 text-xs">
                    Xəta detalları ({rep.errors.length})
                  </summary>
                  <ul className="mt-1 max-h-32 overflow-y-auto text-rust-700">
                    {rep.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Snapshot JSON faylı idxalı — hamısı bir dəfəyə
// ─────────────────────────────────────────────────────────────
const SNAPSHOT_KEYS = [
  "sections", "exercises", "commissions", "commission_exercises",
  "exams", "exam_commissions", "students",
  "experts", "exam_expert_subprofessions", "photos",
];

function SnapshotJsonImportCard() {
  const toast = useToast();
  const [fileName, setFileName] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [counts, setCounts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);

  const reset = () => {
    setFileName("");
    setSnapshot(null);
    setCounts(null);
    setReport(null);
  };

  const onFile = (file) => {
    setReport(null);
    if (!file) { reset(); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("snapshot obyekti gözlənilir");
        }
        const hasAny = SNAPSHOT_KEYS.some((k) => Array.isArray(data[k]));
        if (!hasAny) throw new Error("sections/exercises/exams və s. tapılmadı");

        const c = {};
        for (const k of SNAPSHOT_KEYS) c[k] = Array.isArray(data[k]) ? data[k].length : 0;
        setSnapshot(data);
        setCounts(c);
        toast.success("Fayl oxundu — idxala hazırdır");
      } catch (err) {
        setSnapshot(null);
        setCounts(null);
        toast.error("JSON oxuna bilmədi: " + err.message);
      }
    };
    reader.onerror = () => {
      setSnapshot(null);
      setCounts(null);
      toast.error("Fayl oxunarkən xəta baş verdi");
    };
    reader.readAsText(file);
  };

  const onRun = async () => {
    if (!snapshot) return toast.warn("Əvvəl JSON faylı seçin");
    if (!confirm("Snapshot faylındakı bütün data SQLite-ə köçürüləcək. Davam edək?")) return;
    setBusy(true);
    setReport(null);
    try {
      const result = await api.post("/resultsapp-import/import-json", snapshot);
      setReport(result);
      if (result.failed > 0) toast.warn(`${result.inserted} qeyd köçürüldü, ${result.failed} xəta`);
      else toast.success(`${result.inserted} qeyd köçürüldü`);
    } catch (err) {
      toast.error("İdxal xətası: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Snapshot JSON faylından idxal"
      subtitle="ResultsApp snapshot faylını seçin — bütün data (sections + exercises + commissions + exams + students) bir dəfəyə idxal olunur"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => onFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
        <button
          className="btn-primary"
          onClick={onRun}
          disabled={!snapshot || busy}
        >
          {busy ? "Köçürülür..." : "İdxal et"}
        </button>
      </div>

      {fileName && (
        <p className="mt-2 text-xs text-ink-500">
          Fayl: <span className="font-mono text-ink-700">{fileName}</span>
        </p>
      )}

      {/* Faylın tərkibi (yazılmadan əvvəl) */}
      {counts && (
        <div className="mt-3 text-xs bg-ink-50 border border-ink-200 rounded p-2">
          <div className="font-medium text-ink-800 mb-1">Fayl tərkibi (yazılmayıb):</div>
          <ul className="grid grid-cols-2 gap-x-4">
            {Object.entries(counts).map(([k, v]) => (
              <li key={k} className="text-ink-700">
                <span className="text-ink-500">{k}:</span> <b>{v}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ImportReport report={report} />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  ResultsApp-dan idxal (birbaşa URL)
// ─────────────────────────────────────────────────────────────
function ResultsAppImportCard() {
  const toast = useToast();
  const [filters, setFilters] = useState({
    baseUrl: "http://localhost:5000/api",
    examId: "",
    sectionId: "",
    commissionNo: "",
    from: "",
    to: "",
  });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [report, setReport] = useState(null);

  const buildBody = () => {
    const body = {};
    if (filters.baseUrl)      body.baseUrl = filters.baseUrl;
    if (filters.examId)       body.examId = Number(filters.examId);
    if (filters.sectionId)    body.sectionId = Number(filters.sectionId);
    if (filters.commissionNo) body.commissionNo = filters.commissionNo;
    if (filters.from)         body.from = filters.from;
    if (filters.to)           body.to = filters.to;
    return body;
  };

  const onPreview = async () => {
    setBusy(true);
    setReport(null);
    try {
      const result = await api.post("/resultsapp-import/preview", buildBody());
      setPreview(result);
      toast.success("Önbaxış hazırdır");
    } catch (err) {
      toast.error("Önbaxış xətası: " + err.message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const onRun = async () => {
    if (!confirm("ResultsApp-dan data köçürüləcək. Davam edək?")) return;
    setBusy(true);
    setReport(null);
    try {
      const result = await api.post("/resultsapp-import/run", buildBody());
      setReport(result);
      if (result.failed > 0) toast.warn(`${result.inserted} qeyd köçürüldü, ${result.failed} xəta`);
      else toast.success(`${result.inserted} qeyd köçürüldü`);
    } catch (err) {
      toast.error("İdxal xətası: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="ResultsApp-dan idxal"
      subtitle="Xarici ResultsApp API-sindən birbaşa data çək (sections + exercises + commissions + exams + students)"
    >
      {/* Baza URL */}
      <div className="mb-3">
        <label className="block text-xs text-ink-600 mb-1">ResultsApp baza URL</label>
        <input
          type="text"
          className="field text-sm w-full"
          value={filters.baseUrl}
          onChange={(e) => setFilters({ ...filters, baseUrl: e.target.value })}
          placeholder="http://localhost:5000/api"
        />
      </div>

      {/* Filter sahələri */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
        <div>
          <label className="block text-xs text-ink-600 mb-1">İmtahan ID</label>
          <input
            type="number"
            className="field text-sm w-full"
            value={filters.examId}
            onChange={(e) => setFilters({ ...filters, examId: e.target.value })}
            placeholder="hamısı"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-600 mb-1">Bölmə ID</label>
          <input
            type="number"
            className="field text-sm w-full"
            value={filters.sectionId}
            onChange={(e) => setFilters({ ...filters, sectionId: e.target.value })}
            placeholder="hamısı"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-600 mb-1">Komissiya No</label>
          <input
            type="text"
            className="field text-sm w-full"
            value={filters.commissionNo}
            onChange={(e) => setFilters({ ...filters, commissionNo: e.target.value })}
            placeholder=""
          />
        </div>
        <div>
          <label className="block text-xs text-ink-600 mb-1">Başlama tarixi</label>
          <input
            type="date"
            className="field text-sm w-full"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-ink-600 mb-1">Bitmə tarixi</label>
          <input
            type="date"
            className="field text-sm w-full"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>
      </div>

      {/* Düymələr */}
      <div className="flex items-center gap-2">
        <button
          className="btn-secondary"
          onClick={onPreview}
          disabled={busy}
        >
          {busy ? "..." : "Önbaxış"}
        </button>
        <button
          className="btn-primary"
          onClick={onRun}
          disabled={busy}
        >
          {busy ? "Köçürülür..." : "İdxal et"}
        </button>
      </div>

      {/* Önbaxış nəticəsi */}
      {preview && (
        <div className="mt-3 text-xs bg-ink-50 border border-ink-200 rounded p-2">
          <div className="font-medium text-ink-800 mb-1">Önbaxış (yazılmayıb):</div>
          <ul className="grid grid-cols-2 gap-x-4">
            {Object.entries(preview.counts).map(([k, v]) => (
              <li key={k} className="text-ink-700">
                <span className="text-ink-500">{k}:</span> <b>{v}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Yekun hesabat */}
      <ImportReport report={report} />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  İMTAHAN CRUD
// ─────────────────────────────────────────────────────────────
function ExamTab() {
  const toast = useToast();
  const [exams, setExams] = useState([]);
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState({ name: "", exam_date: "", section_id: "", notes: "" });

  const load = () => {
    api.get("/exams").then(setExams).catch(err => toast.error(err.message));
  };

  useEffect(() => {
    load();
    api.get("/sections").then(setSections).catch(err => toast.error(err.message));
  }, []);

  const onCreate = async () => {
    if (!form.name || !form.exam_date) return toast.warn("Ad və tarix tələb olunur");
    try {
      await api.post("/exams", {
        ...form,
        section_id: form.section_id ? Number(form.section_id) : null,
      });
      toast.success("İmtahan əlavə edildi");
      setForm({ name: "", exam_date: "", section_id: "", notes: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Silinsin? Bu imtahanla bağlı bütün tələbələr və nəticələr də silinəcək!")) return;
    try {
      await api.del(`/exams/${id}`);
      toast.success("Silindi");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <Card title="Yeni imtahan əlavə et">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="field" placeholder="Ad"
                 value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" type="date"
                 value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} />
          <select className="field"
                  value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })}>
            <option value="">— Bölmə (ixtiyari) —</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn-primary" onClick={onCreate}>Əlavə et</button>
        </div>
        <input className="field mt-3" placeholder=""
               value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Card>

      <Card className="mt-4" title="Mövcud imtahanlar">
        {exams.length === 0 ? (
          <EmptyState title="Hələ imtahan yoxdur" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper-100 border-b border-ink-200">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Ad</th>
                <th className="px-3 py-2 text-left">Tarix</th>
                <th className="px-3 py-2 text-left">Bölmə</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {exams.map(e => (
                <tr key={e.id} className="border-t border-ink-100">
                  <td className="px-3 py-2 font-mono">{e.id}</td>
                  <td className="px-3 py-2">{e.name}</td>
                  <td className="px-3 py-2 font-mono">{e.exam_date}</td>
                  <td className="px-3 py-2">{e.section_name || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="text-rust-600 hover:underline text-xs" onClick={() => onDelete(e.id)}>Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  EKSPORT
// ─────────────────────────────────────────────────────────────
function ExportTab() {
  const toast = useToast();
  const [exams, setExams] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [examId, setExamId] = useState("");
  const [commissionNo, setCommissionNo] = useState("");

  useEffect(() => {
    api.get("/exams").then(setExams).catch(err => toast.error(err.message));
    api.get("/commissions").then(setCommissions).catch(err => toast.error(err.message));
  }, []);

  const buildUrl = (format) => {
    const qs = new URLSearchParams();
    if (examId)       qs.set("examId", examId);
    if (commissionNo) qs.set("commissionNo", commissionNo);
    return `/exports/results.${format}?${qs.toString()}`;
  };

  const download = (format) => {
    if (!examId) return toast.warn("Əvvəl imtahan seçin");
    api.download(buildUrl(format));
  };

  return (
    <Card title="Nəticələri ixrac et"
          subtitle="Əsas sistemə yükləmək üçün xlsx/json/csv formatlarında">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="label">İmtahan *</label>
          <select className="field" value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">— Seçin —</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.exam_date})</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Komissiya (boş = hamısı)</label>
          <select className="field" value={commissionNo} onChange={(e) => setCommissionNo(e.target.value)}>
            <option value="">— Hamısı —</option>
            {commissions.map(c => <option key={c.id} value={c.commission_no}>№{c.commission_no} — {c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button className="btn-primary" disabled={!examId} onClick={() => download("xlsx")}>📊 Excel (.xlsx)</button>
        <button className="btn-ghost"   disabled={!examId} onClick={() => download("json")}>📄 JSON</button>
        <button className="btn-ghost"   disabled={!examId} onClick={() => download("csv")}>📋 CSV</button>
      </div>

      <p className="mt-4 text-xs text-ink-500">
        Çıxış formatı: is_n, exercise_code, raw_value, is_refused, notes — əsas sistemin scoring qaydaları
        ilə birgə işlədilir (bal hesablama burada deyil).
      </p>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
//  PAROL
// ─────────────────────────────────────────────────────────────
function PasswordTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!oldPw || !newPw) return toast.warn("Hər iki sahə tələb olunur");
    if (newPw.length < 6) return toast.warn("Yeni parol ən azı 6 simvol");
    setBusy(true);
    try {
      await api.post("/auth/change-password", {
        name: user?.name || "admin",
        oldPassword: oldPw,
        newPassword: newPw,
      });
      toast.success("Parol dəyişdirildi");
      setOldPw("");
      setNewPw("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
     <div className="space-y-6">

    <Card title="Parolu dəyiş" subtitle={`İstifadəçi: ${user?.name || "admin"}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
        <div>
          <label className="label">Cari parol</label>
          <input type="password" className="field" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        </div>
        <div>
          <label className="label">Yeni parol</label>
          <input type="password" className="field" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </div>
      </div>
      <button className="btn-primary mt-4" onClick={submit} disabled={busy}>
        {busy ? "Yeniləyir..." : "Dəyiş"}
      </button>
    </Card>
    <ResultEditPasswordCard />
  </div>
  );
}