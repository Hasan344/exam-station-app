// backend/routes/resultsapp-import.js
//
// ResultsApp master data-sını SQLite-ə yazır. İki mənbə:
//   • Birbaşa URL (ResultsApp API) — /preview, /run
//   • Lokal JSON snapshot faylı     — /import-json
//
// Hər iki yol EYNI topological yazma məntiqini (importSnapshot) işlədir:
//   sections → exercises → commissions → commission_exercises
//   → exams → exam_commissions → students
//
// Mövcud /imports/* endpointlərinin pattern-ini izləyir:
//   • dbRun, dbGet — Promise wrapper-lər (database.js)
//   • runSerial, summarize — excel-helpers.js
//   • ON CONFLICT ... DO UPDATE — SQLite UPSERT
//
// Body (URL idxalı üçün, hamısı opsiyonal):
//   {
//     "baseUrl":      "http://localhost:5000/api",   // ResultsApp baza URL
//     "examId":       1,
//     "sectionId":    1,
//     "from":         "2026-01-01",
//     "to":           "2026-12-31",
//     "commissionNo": "62"
//   }
//
// Body (JSON idxalı /import-json üçün):
//   ResultsApp snapshot obyektinin özü — { sections, exercises, ... }

const express = require("express");
const router = express.Router();
const { dbGet, dbRun } = require("../database");
const { runSerial, summarize } = require("../services/excel-helpers");
const { fetchSnapshot } = require("../services/resultsapp-client");

// Snapshot-da gözlənilən massiv açarları (topological sıra ilə).
const SNAPSHOT_KEYS = [
  "sections",
  "exercises",
  "commissions",
  "commission_exercises",
  "exams",
  "exam_commissions",
  "students",
];

// ─────────────────────────────────────────────────────────────
//  Snapshot-u normallaşdır + doğrula
//  • Obyekt deyilsə və ya heç bir tanınan massiv yoxdursa → 400.
//  • Çatışmayan açarlar boş massivə (`[]`) çevrilir (tolerantlıq üçün).
// ─────────────────────────────────────────────────────────────
function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    const e = new Error("Yanlış format: snapshot obyekti gözlənilir");
    e.status = 400;
    throw e;
  }
  const anyArray = SNAPSHOT_KEYS.some((k) => Array.isArray(raw[k]));
  if (!anyArray) {
    const e = new Error(
      "Yanlış snapshot: sections/exercises/exams və s. massivləri tapılmadı"
    );
    e.status = 400;
    throw e;
  }
  const snap = {};
  for (const k of SNAPSHOT_KEYS) {
    snap[k] = Array.isArray(raw[k]) ? raw[k] : [];
  }
  // Meta sahələri olduğu kimi saxla (UI üçün).
  snap.exported_at = raw.exported_at || null;
  snap.filters = raw.filters || null;
  snap.source = raw.source || null;
  return snap;
}

// Sayğacları ver (preview / UI üçün).
function snapshotCounts(snap) {
  return {
    sections: snap.sections.length,
    exercises: snap.exercises.length,
    commissions: snap.commissions.length,
    commission_exercises: snap.commission_exercises.length,
    exams: snap.exams.length,
    exam_commissions: snap.exam_commissions.length,
    students: snap.students.length,
  };
}

// ═════════════════════════════════════════════════════════════
//  PAYLAŞILAN YAZMA MƏNTİQİ
//  snapshot → SQLite (topological). { reports, totalInserted, totalFailed }
// ═════════════════════════════════════════════════════════════
async function importSnapshot(snapshot) {
  // exam_id remapping: source.id → target.id
  // ResultsApp-dakı exam id-si hədəfdə fərqli ola bilər (məsələn,
  // hədəfdə eyni id-yə malik fərqli imtahan varsa).
  const examIdMap = new Map();
  const reports = {};

  // ─── 1. SECTIONS ─────────────────────────────────────────────────
  reports.sections = summarize(
    await runSerial(snapshot.sections, async (r) => {
      await dbRun(
        `INSERT INTO sections (id, name, sect_code) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           sect_code = excluded.sect_code`,
        [r.id, r.name, r.sect_code || null]
      );
      return { id: r.id };
    }),
    "bölmə"
  );

  // ─── 2. EXERCISES ────────────────────────────────────────────────
  // code UNIQUE — id-ləri biz təyin edirik (auto-increment).
  reports.exercises = summarize(
    await runSerial(snapshot.exercises, async (r) => {
      await dbRun(
        `INSERT INTO exercises (code, name, unit, direction, display_order, notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           name = excluded.name,
           unit = excluded.unit,
           direction = excluded.direction,
           display_order = excluded.display_order,
           notes = excluded.notes`,
        [r.code, r.name, r.unit, r.direction, r.display_order, r.notes || null]
      );
      return { code: r.code };
    }),
    "hərəkət"
  );

  // ─── 3. COMMISSIONS ──────────────────────────────────────────────
  // commission_no UNIQUE — id-ləri biz təyin edirik.
  reports.commissions = summarize(
    await runSerial(snapshot.commissions, async (r) => {
      // section_id mövcuddur? (snapshot içində öncə yazıldı)
      const sec = await dbGet("SELECT id FROM sections WHERE id = ?", [r.section_id]);
      if (!sec) throw new Error(`section_id=${r.section_id} mövcud deyil`);

      await dbRun(
        `INSERT INTO commissions (commission_no, name, section_id) VALUES (?, ?, ?)
         ON CONFLICT(commission_no) DO UPDATE SET
           name = excluded.name,
           section_id = excluded.section_id`,
        [r.commission_no, r.name, r.section_id]
      );
      return { commission_no: r.commission_no };
    }),
    "komissiya"
  );

  // ─── 4. COMMISSION_EXERCISES ─────────────────────────────────────
  // exercise_code → hədəfdəki exercise.id-ni tap (id-lər remap olunur).
  reports.commission_exercises = summarize(
    await runSerial(snapshot.commission_exercises, async (r) => {
      const ex = await dbGet("SELECT id FROM exercises WHERE code = ?", [
        r.exercise_code,
      ]);
      if (!ex) throw new Error(`Hərəkət "${r.exercise_code}" tapılmadı`);

      await dbRun(
        `INSERT INTO commission_exercises (commission_no, exercise_id, display_order)
         VALUES (?, ?, ?)
         ON CONFLICT(commission_no, exercise_id) DO UPDATE SET
           display_order = excluded.display_order`,
        [r.commission_no, ex.id, r.display_order]
      );
      return { commission_no: r.commission_no, exercise_code: r.exercise_code };
    }),
    "bağlantı"
  );

  // ─── 5. EXAMS ────────────────────────────────────────────────────
  // Eşləşdirmə strategiyası:
  //   1) Source-id ilə eyni id var? → UPDATE, eyni id qalır
  //   2) (name, exam_date) eyni? → UPDATE, target-id istifadə et
  //   3) Yenidir → INSERT, lastID alındı, source→target map-ə yaz
  reports.exams = summarize(
    await runSerial(snapshot.exams, async (r) => {
      // 1)
      const byId = await dbGet("SELECT id FROM exams WHERE id = ?", [r.id]);
      if (byId) {
        await dbRun(
          `UPDATE exams SET name = ?, exam_date = ?, section_id = ?, notes = ?
           WHERE id = ?`,
          [r.name, r.exam_date, r.section_id, r.notes || null, r.id]
        );
        examIdMap.set(r.id, r.id);
        return { id: r.id, action: "updated" };
      }
      // 2)
      const byNameDate = await dbGet(
        "SELECT id FROM exams WHERE name = ? AND exam_date = ?",
        [r.name, r.exam_date]
      );
      if (byNameDate) {
        await dbRun(
          `UPDATE exams SET section_id = ?, notes = ? WHERE id = ?`,
          [r.section_id, r.notes || null, byNameDate.id]
        );
        examIdMap.set(r.id, byNameDate.id);
        return { id: byNameDate.id, action: "merged" };
      }
      // 3) — source id-ni saxlamağa çalış
      try {
        await dbRun(
          `INSERT INTO exams (id, name, exam_date, section_id, notes)
           VALUES (?, ?, ?, ?, ?)`,
          [r.id, r.name, r.exam_date, r.section_id, r.notes || null]
        );
        examIdMap.set(r.id, r.id);
        return { id: r.id, action: "inserted" };
      } catch {
        const ins = await dbRun(
          `INSERT INTO exams (name, exam_date, section_id, notes)
           VALUES (?, ?, ?, ?)`,
          [r.name, r.exam_date, r.section_id, r.notes || null]
        );
        examIdMap.set(r.id, ins.lastID);
        return { id: ins.lastID, action: "inserted-new-id" };
      }
    }),
    "imtahan"
  );

  // ─── 6. EXAM_COMMISSIONS ─────────────────────────────────────────
  reports.exam_commissions = summarize(
    await runSerial(snapshot.exam_commissions, async (r) => {
      const targetExamId = examIdMap.get(r.exam_id);
      if (!targetExamId) throw new Error(`exam_id=${r.exam_id} map edilmədi`);

      // Bu cədvəldə ON CONFLICT yoxdur (UNIQUE constraint var)
      // — əvvəlcə yoxla, sonra INSERT et.
      const existing = await dbGet(
        "SELECT id FROM exam_commissions WHERE exam_id = ? AND commission_no = ?",
        [targetExamId, r.commission_no]
      );
      if (!existing) {
        await dbRun(
          "INSERT INTO exam_commissions (exam_id, commission_no) VALUES (?, ?)",
          [targetExamId, r.commission_no]
        );
      }
      return { exam_id: targetExamId, commission_no: r.commission_no };
    }),
    "imtahan-komissiya"
  );

  // ─── 7. STUDENTS ─────────────────────────────────────────────────
  reports.students = summarize(
    await runSerial(snapshot.students, async (r) => {
      const targetExamId = examIdMap.get(r.exam_id);
      if (!targetExamId) throw new Error(`exam_id=${r.exam_id} map edilmədi`);

      // commission_no mövcuddur?
      const comm = await dbGet(
        "SELECT id FROM commissions WHERE commission_no = ?",
        [r.commission_no]
      );
      if (!comm) throw new Error(`Komissiya ${r.commission_no} tapılmadı`);

      await dbRun(
        `INSERT INTO students
           (exam_id, s_nomer, is_n, surname, name, father_name, birth_date,
            gender, qrup_num, kodixtisas, ixtisas_name, alt_nov, commission_no)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(exam_id, is_n) DO UPDATE SET
           s_nomer = excluded.s_nomer,
           surname = excluded.surname,
           name = excluded.name,
           father_name = excluded.father_name,
           birth_date = excluded.birth_date,
           gender = excluded.gender,
           qrup_num = excluded.qrup_num,
           kodixtisas = excluded.kodixtisas,
           ixtisas_name = excluded.ixtisas_name,
           alt_nov = excluded.alt_nov,
           commission_no = excluded.commission_no`,
        [
          targetExamId, r.s_nomer, r.is_n, r.surname, r.name,
          r.father_name || null, r.birth_date || null,
          r.gender, r.qrup_num, r.kodixtisas || null,
          r.ixtisas_name || null, r.alt_nov || null, r.commission_no,
        ]
      );
      return { is_n: r.is_n };
    }),
    "tələbə"
  );

  // ─── Yekun ───────────────────────────────────────────────────────
  const totalInserted = Object.values(reports).reduce((s, r) => s + r.inserted, 0);
  const totalFailed = Object.values(reports).reduce((s, r) => s + r.failed, 0);
  return { reports, totalInserted, totalFailed };
}

// ─────────── /resultsapp-import/preview ───────────
// Yazma əməliyyatı yoxdur — sadəcə ResultsApp-dan nə gələcəyini göstərir.
router.post("/preview", express.json(), async (req, res) => {
  try {
    const snapshot = await fetchSnapshot(req.body || {});
    res.json({
      ok: true,
      counts: snapshotCounts(normalizeSnapshot(snapshot)),
      exported_at: snapshot.exported_at,
      filters: snapshot.filters,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ─────────── /resultsapp-import/run ───────────
// ResultsApp API-sindən birbaşa çək və SQLite-ə yaz.
router.post("/run", express.json(), async (req, res) => {
  try {
    const raw = await fetchSnapshot(req.body || {});
    const snapshot = normalizeSnapshot(raw);
    const { reports, totalInserted, totalFailed } = await importSnapshot(snapshot);

    res.json({
      ok: true,
      message: `${totalInserted} qeyd köçürüldü${totalFailed ? `, ${totalFailed} xəta` : ""}`,
      inserted: totalInserted,
      failed: totalFailed,
      reports,
      filters: snapshot.filters,
      exported_at: snapshot.exported_at,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ─────────── /resultsapp-import/import-json ───────────
// Lokal snapshot JSON faylının məzmunu birbaşa body-də gəlir.
// Bütün master data-nı bir dəfəyə SQLite-ə yazır (URL-ə qoşulmadan).
router.post("/import-json", express.json({ limit: "50mb" }), async (req, res) => {
  try {
    const snapshot = normalizeSnapshot(req.body);
    const { reports, totalInserted, totalFailed } = await importSnapshot(snapshot);

    res.json({
      ok: true,
      message: `${totalInserted} qeyd köçürüldü${totalFailed ? `, ${totalFailed} xəta` : ""}`,
      inserted: totalInserted,
      failed: totalFailed,
      reports,
      filters: snapshot.filters,
      exported_at: snapshot.exported_at,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

module.exports = router;