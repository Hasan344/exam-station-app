// backend/routes/exports.js
//
// Nəticələri əsas sistemə yükləmək üçün ixrac.
// Çıxış formatı şablonla EYNİDİR (nəticələr_şablon):
//   is_n, exercise_code, raw_value, is_refused, notes,
//   appeal_score, appeal_raw_value, appeal_decision, appeal_notes
//
// (Bal hesablama əsas layihənin scoring_rules-u üzərindən aparılır.
//  appeal_score = operatorun apellyasiyada yazdığı dəyər (appeal_value).)

const express = require("express");
const router = express.Router();
const XLSX = require("xlsx");
const { dbAll } = require("../database");

// İxrac sütunlarının sırası (şablonla eyni) — json_to_sheet header kimi verilir.
const EXPORT_HEADER = [
  "is_n",
  "exercise_code",
  "raw_value",
  "is_refused",
  "notes",
  "appeal_score",
  "appeal_raw_value",
  "appeal_decision",
  "appeal_notes",
];

async function fetchRows(examId, commissionNo) {
  const params = [examId];
  let sql = `
    SELECT s.commission_no, s.s_nomer, s.is_n,
           e.code AS exercise_code, e.name AS exercise_name, e.unit,
           r.raw_value, r.is_refused, r.notes,
           r.appeal_value, r.appeal_is_refused, r.appeal_notes,
           r.recorded_at, r.updated_at
    FROM student_exam_results r
    JOIN students  s ON s.id = r.student_id
    JOIN exercises e ON e.id = r.exercise_id
    WHERE r.exam_id = ?
  `;
  if (commissionNo) {
    sql += " AND s.commission_no = ?";
    params.push(commissionNo);
  }
  sql += " ORDER BY s.commission_no, s.s_nomer, e.display_order, e.id";
  return dbAll(sql, params);
}

// Apellyasiya mövcuddurmu? (dəyər yazılıb VƏ YA imtina işarələnib)
function hasAppeal(r) {
  return r.appeal_value != null || !!r.appeal_is_refused;
}

// "dəyişdi" / "dəyişmədi" — apellyasiyanı əsas nəticə ilə müqayisə edərək.
function appealDecision(r) {
  if (!hasAppeal(r)) return null;
  const sameRefused = !!r.appeal_is_refused === !!r.is_refused;
  const sameValue = r.appeal_is_refused
    ? true // hər ikisi imtinadırsa dəyər müqayisəsi lazım deyil
    : Number(r.appeal_value) === Number(r.raw_value);
  return sameRefused && sameValue ? "dəyişmədi" : "dəyişdi";
}

function flattenForExport(rows) {
  return rows.map(r => ({
    is_n:             r.is_n,
    exercise_code:    r.exercise_code,
    raw_value:        r.is_refused ? null : r.raw_value,
    is_refused:       r.is_refused ? true : null,        // imtina → true, deyilsə boş
    notes:            r.notes ?? null,
    appeal_score:     hasAppeal(r) && !r.appeal_is_refused ? r.appeal_value : null,
    appeal_raw_value: null,                              // DB-də ayrıca sahə yoxdur — boş qalır
    appeal_decision:  appealDecision(r),                 // dəyişdi | dəyişmədi | boş
    appeal_notes:     r.appeal_notes ?? null,
  }));
}

// GET /exports/results.xlsx?examId=X&commissionNo=Y
router.get("/results.xlsx", async (req, res) => {
  try {
    const { examId, commissionNo } = req.query;
    if (!examId) return res.status(400).json({ message: "examId tələb olunur" });

    const rows = await fetchRows(examId, commissionNo);
    const flat = flattenForExport(rows);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(flat, { header: EXPORT_HEADER });
    XLSX.utils.book_append_sheet(wb, ws, "Nəticələr");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const fname = `results_exam${examId}${commissionNo ? `_c${commissionNo}` : ""}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /exports/results.json?examId=X&commissionNo=Y
router.get("/results.json", async (req, res) => {
  try {
    const { examId, commissionNo } = req.query;
    if (!examId) return res.status(400).json({ message: "examId tələb olunur" });

    const rows = await fetchRows(examId, commissionNo);
    const payload = {
      examId: Number(examId),
      commissionNo: commissionNo || null,
      exportedAt: new Date().toISOString(),
      count: rows.length,
      results: flattenForExport(rows),
    };

    const fname = `results_exam${examId}${commissionNo ? `_c${commissionNo}` : ""}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /exports/results.csv?examId=X&commissionNo=Y
router.get("/results.csv", async (req, res) => {
  try {
    const { examId, commissionNo } = req.query;
    if (!examId) return res.status(400).json({ message: "examId tələb olunur" });

    const rows = await fetchRows(examId, commissionNo);
    const flat = flattenForExport(rows);
    const ws = XLSX.utils.json_to_sheet(flat, { header: EXPORT_HEADER });
    const csv = XLSX.utils.sheet_to_csv(ws);

    const fname = `results_exam${examId}${commissionNo ? `_c${commissionNo}` : ""}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.send("\uFEFF" + csv); // BOM — Excel-də Azərbaycan hərfləri düzgün görünsün
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
