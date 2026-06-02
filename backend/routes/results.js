// backend/routes/results.js
//
// Nəticə yığımı (raw_value) + APELLYASIYA (appeal_value). Bal hesablama YOXDUR.
//
// Davranış:
//   • Hər saxlanılan nəticə KİLİDLƏNİR (locked=1).
//   • Apellyasiya da eyni məntiqlə işləyir: saxlananda appeal_locked=1.
//   • Kilidli nəticə / apellyasiya yalnız düzgün "redaktə parolu" ilə dəyişdirilə bilər.
//   • Redaktə parolu app_settings cədvəlində bcrypt hash kimi saxlanılır.
//
// Endpointlər:
//   GET    /results/edit-password/status
//   POST   /results/edit-password
//   POST   /results/verify-edit-password
//   POST   /results/single
//   POST   /results/bulk
//   PUT    /results/:id
//   POST   /results/appeal/single        ← apellyasiya yaz/yenilə (kilidlə)
//   GET    /results
//   DELETE /results/:id

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { db, dbAll, dbGet, dbRun } = require("../database");

const EDIT_PW_KEY = "result_edit_password";

// ─────────── köməkçilər ───────────
async function getEditPasswordHash() {
  const row = await dbGet("SELECT value FROM app_settings WHERE key = ?", [EDIT_PW_KEY]);
  return row ? row.value : null;
}

async function verifyEditPassword(password) {
  if (!password) return false;
  const hash = await getEditPasswordHash();
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

function validateItem(it) {
  if (!it || !it.studentId || !it.examId || !it.exerciseId) {
    return "studentId, examId, exerciseId tələb olunur";
  }
  if (!it.isRefused && (it.rawValue === undefined || it.rawValue === null || it.rawValue === "")) {
    return "imtina deyilsə rawValue daxil edilməlidir";
  }
  if (!it.isRefused) {
    const n = Number(it.rawValue);
    if (Number.isNaN(n) || n < 0) return "rawValue müsbət ədəd olmalıdır";
  }
  return null;
}

function validateAppeal(it) {
  if (!it || !it.studentId || !it.examId || !it.exerciseId) {
    return "studentId, examId, exerciseId tələb olunur";
  }
  if (!it.appealIsRefused && (it.appealValue === undefined || it.appealValue === null || it.appealValue === "")) {
    return "imtina deyilsə appealValue daxil edilməlidir";
  }
  if (!it.appealIsRefused) {
    const n = Number(it.appealValue);
    if (Number.isNaN(n) || n < 0) return "appealValue müsbət ədəd olmalıdır";
  }
  return null;
}

// ════════════════════════════════════════════════════════════
//  REDAKTƏ PAROLU
// ════════════════════════════════════════════════════════════
router.get("/edit-password/status", async (_req, res) => {
  try {
    const hash = await getEditPasswordHash();
    res.json({ isSet: !!hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/edit-password", async (req, res) => {
  try {
    const { newPassword, currentPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 4) {
      return res.status(400).json({ message: "Yeni parol ən azı 4 simvol olmalıdır" });
    }
    const existing = await getEditPasswordHash();
    if (existing) {
      const ok = await bcrypt.compare(currentPassword || "", existing);
      if (!ok) return res.status(401).json({ message: "Cari redaktə parolu yanlışdır" });
    }
    const hash = bcrypt.hashSync(String(newPassword), 10);
    await dbRun(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [EDIT_PW_KEY, hash]
    );
    res.json({
      success: true,
      message: existing ? "Redaktə parolu yeniləndi" : "Redaktə parolu təyin edildi",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/verify-edit-password", async (req, res) => {
  try {
    const { password } = req.body || {};
    const ok = await verifyEditPassword(password);
    if (!ok) {
      return res.status(401).json({ ok: false, message: "Redaktə parolu yanlışdır və ya təyin olunmayıb" });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  NƏTİCƏ YAZIMI
// ════════════════════════════════════════════════════════════
router.post("/single", async (req, res) => {
  try {
    const it = req.body || {};
    const { recordedBy, editPassword } = it;

    const err = validateItem(it);
    if (err) return res.status(400).json({ message: err });

    const existing = await dbGet(
      "SELECT id, locked FROM student_exam_results WHERE student_id = ? AND exercise_id = ?",
      [it.studentId, it.exerciseId]
    );
    if (existing && existing.locked) {
      const ok = await verifyEditPassword(editPassword);
      if (!ok) {
        return res.status(403).json({ message: "Bu nəticə kilidlidir. Redaktə parolu tələb olunur.", locked: true });
      }
    }

    const rawValue = it.isRefused ? null : Number(it.rawValue);
    const isRefused = it.isRefused ? 1 : 0;

    await dbRun(
      `INSERT INTO student_exam_results
         (student_id, exam_id, exercise_id, raw_value, is_refused, notes, recorded_by, locked)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(student_id, exercise_id)
       DO UPDATE SET
         raw_value   = excluded.raw_value,
         is_refused  = excluded.is_refused,
         notes       = excluded.notes,
         recorded_by = excluded.recorded_by,
         locked      = 1`,
      [it.studentId, it.examId, it.exerciseId, rawValue, isRefused, it.notes ?? null, recordedBy ?? null]
    );

    const row = await dbGet(
      "SELECT * FROM student_exam_results WHERE student_id = ? AND exercise_id = ?",
      [it.studentId, it.exerciseId]
    );
    res.json({ saved: true, result: row });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/bulk", async (req, res) => {
  const { recordedBy, items, editPassword } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "items massivi boş ola bilməz" });
  }
  for (let i = 0; i < items.length; i++) {
    const e = validateItem(items[i]);
    if (e) return res.status(400).json({ message: `Sətir ${i + 1}: ${e}` });
  }

  try {
    let pwOk = null;
    for (const it of items) {
      const ex = await dbGet(
        "SELECT locked FROM student_exam_results WHERE student_id = ? AND exercise_id = ?",
        [it.studentId, it.exerciseId]
      );
      if (ex && ex.locked) {
        if (pwOk === null) pwOk = await verifyEditPassword(editPassword);
        if (!pwOk) {
          return res.status(403).json({ message: "Bəzi nəticələr kilidlidir. Redaktə parolu tələb olunur.", locked: true });
        }
      }
    }

    await new Promise((resolve, reject) => {
      db.run("BEGIN IMMEDIATE TRANSACTION", (err) => err ? reject(err) : resolve());
    });

    const saved = [];
    for (const it of items) {
      const rawValue = it.isRefused ? null : Number(it.rawValue);
      const isRefused = it.isRefused ? 1 : 0;
      await dbRun(
        `INSERT INTO student_exam_results
           (student_id, exam_id, exercise_id, raw_value, is_refused, notes, recorded_by, locked)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(student_id, exercise_id)
         DO UPDATE SET
           raw_value   = excluded.raw_value,
           is_refused  = excluded.is_refused,
           notes       = excluded.notes,
           recorded_by = excluded.recorded_by,
           locked      = 1`,
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

router.put("/:id", async (req, res) => {
  try {
    const { rawValue, isRefused, notes, editPassword, recordedBy } = req.body || {};
    const row = await dbGet("SELECT * FROM student_exam_results WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ message: "Nəticə tapılmadı" });

    if (row.locked) {
      const ok = await verifyEditPassword(editPassword);
      if (!ok) return res.status(403).json({ message: "Redaktə parolu yanlışdır və ya təyin olunmayıb", locked: true });
    }

    const refused = isRefused ? 1 : 0;
    if (!refused && (rawValue === undefined || rawValue === null || rawValue === "")) {
      return res.status(400).json({ message: "imtina deyilsə rawValue daxil edilməlidir" });
    }
    const value = refused ? null : Number(rawValue);
    if (!refused && (Number.isNaN(value) || value < 0)) {
      return res.status(400).json({ message: "rawValue müsbət ədəd olmalıdır" });
    }

    await dbRun(
      `UPDATE student_exam_results
       SET raw_value = ?, is_refused = ?, notes = ?, recorded_by = COALESCE(?, recorded_by), locked = 1
       WHERE id = ?`,
      [value, refused, notes ?? null, recordedBy ?? null, req.params.id]
    );

    const updated = await dbGet("SELECT * FROM student_exam_results WHERE id = ?", [req.params.id]);
    res.json({ saved: true, result: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  APELLYASIYA
// ════════════════════════════════════════════════════════════
// POST /results/appeal/single
// body: { studentId, examId, exerciseId, appealValue, appealIsRefused?, appealNotes?, recordedBy?, editPassword? }
//   Eyni (student, exercise) sətrinə apellyasiya yazır və kilidləyir.
//   Əsas nəticə (raw_value) toxunulmaz qalır.
router.post("/appeal/single", async (req, res) => {
  try {
    const it = req.body || {};
    const { recordedBy, editPassword } = it;

    const err = validateAppeal(it);
    if (err) return res.status(400).json({ message: err });

    const existing = await dbGet(
      "SELECT id, appeal_locked FROM student_exam_results WHERE student_id = ? AND exercise_id = ?",
      [it.studentId, it.exerciseId]
    );
    if (existing && existing.appeal_locked) {
      const ok = await verifyEditPassword(editPassword);
      if (!ok) {
        return res.status(403).json({ message: "Bu apellyasiya kilidlidir. Redaktə parolu tələb olunur.", locked: true });
      }
    }

    const appealValue = it.appealIsRefused ? null : Number(it.appealValue);
    const appealIsRefused = it.appealIsRefused ? 1 : 0;

    // Yeni sətir yaranırsa əsas nəticə boş qalır (raw_value NULL, is_refused 0);
    // mövcud sətir varsa yalnız appeal_* sahələri yenilənir.
    await dbRun(
      `INSERT INTO student_exam_results
         (student_id, exam_id, exercise_id, raw_value, is_refused,
          appeal_value, appeal_is_refused, appeal_notes, appeal_recorded_by, appeal_recorded_at, appeal_locked)
       VALUES (?, ?, ?, NULL, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)
       ON CONFLICT(student_id, exercise_id)
       DO UPDATE SET
         appeal_value       = excluded.appeal_value,
         appeal_is_refused  = excluded.appeal_is_refused,
         appeal_notes       = excluded.appeal_notes,
         appeal_recorded_by = excluded.appeal_recorded_by,
         appeal_recorded_at = CURRENT_TIMESTAMP,
         appeal_locked      = 1`,
      [it.studentId, it.examId, it.exerciseId, appealValue, appealIsRefused, it.appealNotes ?? null, recordedBy ?? null]
    );

    const row = await dbGet(
      "SELECT * FROM student_exam_results WHERE student_id = ? AND exercise_id = ?",
      [it.studentId, it.exerciseId]
    );
    res.json({ saved: true, result: row });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  SİYAHI / SİLMƏ
// ════════════════════════════════════════════════════════════
router.get("/", async (req, res) => {
  try {
    const { examId, commissionNo, exerciseId } = req.query;
    const params = [];
    let sql = `
      SELECT r.id, r.student_id, r.exam_id, r.exercise_id, r.raw_value,
             r.is_refused, r.notes, r.recorded_by, r.recorded_at, r.updated_at, r.locked,
             r.appeal_value, r.appeal_is_refused, r.appeal_notes,
             r.appeal_recorded_by, r.appeal_recorded_at, r.appeal_locked,
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

router.delete("/:id", async (req, res) => {
  try {
    const row = await dbGet("SELECT locked FROM student_exam_results WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ message: "Tapılmadı" });
    if (row.locked) {
      const ok = await verifyEditPassword(req.body?.editPassword);
      if (!ok) return res.status(403).json({ message: "Kilidli nəticəni silmək üçün redaktə parolu tələb olunur", locked: true });
    }
    await dbRun("DELETE FROM student_exam_results WHERE id = ?", [req.params.id]);
    res.json({ message: "Silindi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
