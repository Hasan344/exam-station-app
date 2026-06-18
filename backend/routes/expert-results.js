// backend/routes/expert-results.js
//
// Section 3 — EKSPERT BAZLI NƏTİCƏ YIĞIMI.
// Hər imtahanın ekspertləri exam_expert_subprofession-dan gəlir;
// hər (tələbə, ekspert) cütü üçün 0–100 arası TAM ədəd bal yazılır.
//
// Davranış student_exam_results ilə EYNİDİR:
//   • Hər saxlanılan bal KİLİDLƏNİR (locked=1).
//   • Kilidli bal yalnız düzgün "redaktə parolu" ilə dəyişdirilə bilər
//     (app_settings.result_edit_password — results.js ilə eyni açar).
//
// Endpointlər:
//   GET    /expert-results/exam/:examId/experts   ← imtahanın ekspertləri
//   GET    /expert-results/student/:studentId      ← tələbənin ekspert balları
//   POST   /expert-results/single                  ← bal yaz/yenilə (kilidlə)
//   GET    /expert-results?examId=&commissionNo=   ← siyahı (nəticələr səhifəsi)
//   DELETE /expert-results/:id

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { dbAll, dbGet, dbRun } = require("../database");

const EDIT_PW_KEY = "result_edit_password";

// ─────────── köməkçilər (results.js ilə eyni) ───────────
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
  if (!it || !it.studentId || !it.examId || !it.expertId) {
    return "studentId, examId, expertId tələb olunur";
  }
  if (!it.isRefused && (it.score === undefined || it.score === null || it.score === "")) {
    return "imtina deyilsə score daxil edilməlidir";
  }
  if (!it.isRefused) {
    const n = Number(it.score);
    if (!Number.isInteger(n)) return "score tam ədəd olmalıdır (kəsr hissə olmaz)";
    if (n < 0 || n > 100) return "score 0–100 aralığında olmalıdır";
  }
  return null;
}

// ════════════════════════════════════════════════════════════
//  İMTAHANIN EKSPERTLƏRİ
// ════════════════════════════════════════════════════════════
router.get("/exam/:examId/experts", async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT ex.id, ex.name
       FROM exam_expert_subprofession ees
       JOIN experts ex ON ex.id = ees.expert_id
       WHERE ees.exam_id = ?
       ORDER BY ex.id`,
      [req.params.examId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  TƏLƏBƏNİN EKSPERT BALLARI
// ════════════════════════════════════════════════════════════
router.get("/student/:studentId", async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT r.id, r.student_id, r.exam_id, r.expert_id, r.score,
              r.is_refused, r.notes, r.recorded_by, r.recorded_at, r.updated_at, r.locked,
              ex.name AS expert_name
       FROM student_expert_results r
       JOIN experts ex ON ex.id = r.expert_id
       WHERE r.student_id = ?
       ORDER BY r.expert_id`,
      [req.params.studentId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  BAL YAZIMI
// ════════════════════════════════════════════════════════════
router.post("/single", async (req, res) => {
  try {
    const it = req.body || {};
    const { recordedBy, editPassword } = it;

    const err = validateItem(it);
    if (err) return res.status(400).json({ message: err });

    // Ekspert həqiqətən bu imtahana bağlıdırmı?
    const link = await dbGet(
      "SELECT id FROM exam_expert_subprofession WHERE exam_id = ? AND expert_id = ?",
      [it.examId, it.expertId]
    );
    if (!link) {
      return res.status(400).json({ message: "Bu ekspert bu imtahana təyin olunmayıb" });
    }

    const existing = await dbGet(
      "SELECT id, locked FROM student_expert_results WHERE student_id = ? AND expert_id = ?",
      [it.studentId, it.expertId]
    );
    if (existing && existing.locked) {
      const ok = await verifyEditPassword(editPassword);
      if (!ok) {
        return res.status(403).json({ message: "Bu bal kilidlidir. Redaktə parolu tələb olunur.", locked: true });
      }
    }

    const score = it.isRefused ? null : Number(it.score);
    const isRefused = it.isRefused ? 1 : 0;

    await dbRun(
      `INSERT INTO student_expert_results
         (student_id, exam_id, expert_id, score, is_refused, notes, recorded_by, locked)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(student_id, expert_id)
       DO UPDATE SET
         score       = excluded.score,
         is_refused  = excluded.is_refused,
         notes       = excluded.notes,
         recorded_by = excluded.recorded_by,
         locked      = 1`,
      [it.studentId, it.examId, it.expertId, score, isRefused, it.notes ?? null, recordedBy ?? null]
    );

    const row = await dbGet(
      "SELECT * FROM student_expert_results WHERE student_id = ? AND expert_id = ?",
      [it.studentId, it.expertId]
    );
    res.json({ saved: true, result: row });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  SİYAHI (nəticələr səhifəsi üçün) / SİLMƏ
// ════════════════════════════════════════════════════════════
router.get("/", async (req, res) => {
  try {
    const { examId, commissionNo, expertId } = req.query;
    const params = [];
    let sql = `
      SELECT r.id, r.student_id, r.exam_id, r.expert_id, r.score,
             r.is_refused, r.notes, r.recorded_by, r.recorded_at, r.updated_at, r.locked,
             ex.name AS expert_name,
             s.s_nomer, s.is_n, s.surname, s.name, s.father_name, s.commission_no
      FROM student_expert_results r
      JOIN students s  ON s.id = r.student_id
      JOIN experts  ex ON ex.id = r.expert_id
      WHERE 1=1
    `;
    if (examId)       { sql += " AND r.exam_id = ?";       params.push(examId); }
    if (commissionNo) { sql += " AND s.commission_no = ?"; params.push(commissionNo); }
    if (expertId)     { sql += " AND r.expert_id = ?";     params.push(expertId); }
    sql += " ORDER BY s.commission_no, s.s_nomer, r.expert_id";
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const row = await dbGet("SELECT locked FROM student_expert_results WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ message: "Tapılmadı" });
    if (row.locked) {
      const ok = await verifyEditPassword(req.body?.editPassword);
      if (!ok) return res.status(403).json({ message: "Kilidli balı silmək üçün redaktə parolu tələb olunur", locked: true });
    }
    await dbRun("DELETE FROM student_expert_results WHERE id = ?", [req.params.id]);
    res.json({ message: "Silindi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
