// backend/routes/students.js
//
// Tələbə axtarışı (komissiya + sıra №) və mövcud nəticələrin gətirilməsi.
// Şəkillər: backend/photos/{exam_id}/{is_n}.{jpg|png} qovluğundan oxunur
// (istifadəçi şəkilləri əvvəlcədən bu qovluğa yerləşdirir, idxalla yox).

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { dbAll, dbGet, dbRun } = require("../database");

// ─────────── Photo storage path resolver ───────────
// Şəkillər istifadəçi özü tərəfindən qoyulur, ona görə yer iki ola bilər:
//   1) Dev: backend/photos/ (mənbə qovluğunda)
//   2) Prod: userData/photos/ (Electron istifadəçi qovluğu)
// İkisinə də baxırıq, hansını tapırsa o istifadə olunur.
function resolvePhotoRoots() {
  const roots = [];
  if (process.env.USER_DATA_DIR) {
    roots.push(path.join(process.env.USER_DATA_DIR, "photos"));
  }
  roots.push(path.resolve(__dirname, "..", "photos"));
  return roots;
}

function findPhotoFile(examId, isN) {
  if (!examId || !isN) return null;
  const roots = resolvePhotoRoots();
  // İcazə verilən genişləndirmələr
  const exts = ["jpg", "jpeg", "png", "JPG", "JPEG", "PNG"];
  for (const root of roots) {
    for (const ext of exts) {
      const p = path.join(root, String(examId), `${isN}.${ext}`);
      if (fs.existsSync(p)) return p;
    }
    // Alternativ: birbaşa exam_id qovluğusuz, yalnız isN
    for (const ext of exts) {
      const p = path.join(root, `${isN}.${ext}`);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// GET /students?examId=X&commissionNo=Y
//   filtrli siyahı (admin/baxış səhifəsi üçün)
router.get("/", async (req, res) => {
  try {
    const { examId, commissionNo, limit = 500 } = req.query;
    const params = [];
    let sql = `SELECT id, exam_id, s_nomer, is_n, surname, name, father_name,
                       birth_date, gender, qrup_num, kodixtisas, ixtisas_name,
                       alt_nov, commission_no, photo_path
                FROM students WHERE 1=1`;
    if (examId)       { sql += " AND exam_id = ?";       params.push(examId); }
    if (commissionNo) { sql += " AND commission_no = ?"; params.push(commissionNo); }
    sql += " ORDER BY s_nomer LIMIT ?";
    params.push(Number(limit));
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /students/lookup?examId=X&commissionNo=Y&sNomer=Z
//   stansiya səhifəsində sıra № daxil olunanda çağırılır
router.get("/lookup", async (req, res) => {
  try {
    const { examId, commissionNo, sNomer } = req.query;
    if (!examId || !commissionNo || !sNomer) {
      return res.status(400).json({ message: "examId, commissionNo, sNomer tələb olunur" });
    }
    const row = await dbGet(
      `SELECT id, exam_id, s_nomer, is_n, surname, name, father_name,
              birth_date, gender, qrup_num, kodixtisas, ixtisas_name,
              alt_nov, commission_no, photo_path
       FROM students
       WHERE exam_id = ? AND commission_no = ? AND s_nomer = ?`,
      [examId, commissionNo, sNomer]
    );
    if (!row) return res.status(404).json({ message: "Bu sıra nömrəsi ilə tələbə tapılmadı" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /students/:id — tək tələbə
router.get("/:id", async (req, res) => {
  try {
    const row = await dbGet("SELECT * FROM students WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ message: "Tələbə tapılmadı" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /students/:id/results
//   tələbənin bütün hərəkətlərə görə qeyd edilmiş nəticələri
router.get("/:id/results", async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT r.id, r.student_id, r.exam_id, r.exercise_id, r.raw_value,
              r.is_refused, r.notes, r.recorded_by, r.recorded_at, r.updated_at,
              e.code AS exercise_code, e.name AS exercise_name, e.unit, e.direction
       FROM student_exam_results r
       JOIN exercises e ON e.id = r.exercise_id
       WHERE r.student_id = ?
       ORDER BY e.display_order, e.id`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /students/:id/photo
//   Tələbənin şəklini binary olaraq qaytarır.
//   Fayl backend/photos/{exam_id}/{is_n}.{jpg|png} qovluğunda axtarılır.
//   Yoxdursa 404.
router.get("/:id/photo", async (req, res) => {
  try {
    const s = await dbGet(
      "SELECT exam_id, is_n FROM students WHERE id = ?",
      [req.params.id]
    );
    if (!s) return res.status(404).end();

    const photoPath = findPhotoFile(s.exam_id, s.is_n);
    if (!photoPath) return res.status(404).end();

    const ext = path.extname(photoPath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=3600");
    fs.createReadStream(photoPath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /students/:id/photo/exists
//   Yüngül HEAD-kimi endpoint — UI dilemma-sız yoxlamaq üçün ({ exists: bool }).
router.get("/:id/photo/exists", async (req, res) => {
  try {
    const s = await dbGet(
      "SELECT exam_id, is_n FROM students WHERE id = ?",
      [req.params.id]
    );
    if (!s) return res.json({ exists: false });
    res.json({ exists: !!findPhotoFile(s.exam_id, s.is_n) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
