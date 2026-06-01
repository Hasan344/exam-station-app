// backend/routes/results.js
//
// Nəticə yığımı (raw_value). Bal hesablama YOXDUR — yalnız xam dəyər saxlanılır.
// Stansiya səhifəsi adətən bir tələbə üçün eyni anda bir neçə hərəkətin nəticəsini
// göndərir, ona görə əsas endpoint /results/bulk-dur.

const express = require("express");
const router = express.Router();
const { db, dbAll, dbGet, dbRun } = require("../database");

// POST /results/bulk
// body: {
//   recordedBy?: "admin",
//   items: [
//     { studentId, examId, exerciseId, rawValue, isRefused?, notes? }
//   ]
// }
router.post("/bulk", async (req, res) => {
  const { recordedBy, items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "items massivi boş ola bilməz" });
  }

  // Validasiya — server tərəfində dəyəri yoxlamaq vacibdir
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.studentId || !it.examId || !it.exerciseId) {
      return res.status(400).json({
        message: `Sətir ${i + 1}: studentId, examId, exerciseId tələb olunur`,
      });
    }
    if (!it.isRefused && (it.rawValue === undefined || it.rawValue === null || it.rawValue === "")) {
      return res.status(400).json({
        message: `Sətir ${i + 1}: imtina deyilsə rawValue daxil edilməlidir`,
      });
    }
  }

  // Tək tranzaksiyada upsert et — biri uğursuz olarsa hamısı geri qayıdır
  try {
    await new Promise((resolve, reject) => {
      db.run("BEGIN IMMEDIATE TRANSACTION", (err) => err ? reject(err) : resolve());
    });

    const saved = [];
    for (const it of items) {
      const rawValue = it.isRefused ? null : Number(it.rawValue);
      const isRefused = it.isRefused ? 1 : 0;
      await dbRun(
        `INSERT INTO student_exam_results
           (student_id, exam_id, exercise_id, raw_value, is_refused, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(student_id, exercise_id)
         DO UPDATE SET
           raw_value   = excluded.raw_value,
           is_refused  = excluded.is_refused,
           notes       = excluded.notes,
           recorded_by = excluded.recorded_by`,
        [it.studentId, it.examId, it.exerciseId, rawValue, isRefused, it.notes ?? null, recordedBy ?? null]
      );
      saved.push({ studentId: it.studentId, exerciseId: it.exerciseId });
    }

    await new Promise((resolve, reject) => {
      db.run("COMMIT", (err) => err ? reject(err) : resolve());
    });

    res.json({ saved: saved.length, items: saved });
  } catch (err) {
    await new Promise((resolve) => db.run("ROLLBACK", () => resolve()));
    res.status(500).json({ message: err.message });
  }
});

// GET /results?examId=X&commissionNo=Y&exerciseId=Z
//   filtirli nəticələr siyahısı (admin/baxış üçün)
router.get("/", async (req, res) => {
  try {
    const { examId, commissionNo, exerciseId } = req.query;
    const params = [];
    let sql = `
      SELECT r.id, r.student_id, r.exam_id, r.exercise_id, r.raw_value,
             r.is_refused, r.notes, r.recorded_by, r.recorded_at, r.updated_at,
             s.s_nomer, s.is_n, s.surname, s.name, s.father_name, s.commission_no,
             e.code AS exercise_code, e.name AS exercise_name, e.unit
      FROM student_exam_results r
      JOIN students s  ON s.id = r.student_id
      JOIN exercises e ON e.id = r.exercise_id
      WHERE 1=1
    `;
    if (examId)       { sql += " AND r.exam_id = ?";        params.push(examId); }
    if (commissionNo) { sql += " AND s.commission_no = ?";  params.push(commissionNo); }
    if (exerciseId)   { sql += " AND r.exercise_id = ?";    params.push(exerciseId); }
    sql += " ORDER BY s.commission_no, s.s_nomer, e.display_order";
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /results/:id — tək nəticə sil
router.delete("/:id", async (req, res) => {
  try {
    const r = await dbRun("DELETE FROM student_exam_results WHERE id = ?", [req.params.id]);
    if (r.changes === 0) return res.status(404).json({ message: "Tapılmadı" });
    res.json({ message: "Silindi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
