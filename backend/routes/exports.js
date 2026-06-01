// backend/routes/exports.js
//
// Nəticələri əsas sistemə yükləmək üçün ixrac.
// Format hər zaman eyni — əsas layihə bu strukturu gözləyir:
//   { is_n, exercise_code, raw_value, is_refused, notes, recorded_at }
// (Bal hesablama əsas layihənin scoring_rules-u üzərindən aparılır.)

const express = require("express");
const router = express.Router();
const XLSX = require("xlsx");
const { dbAll } = require("../database");

async function fetchRows(examId, commissionNo) {
  const params = [examId];
  let sql = `
    SELECT s.commission_no, s.s_nomer, s.is_n, s.surname, s.name, s.father_name,
           s.kodixtisas, s.ixtisas_name,
           e.code AS exercise_code, e.name AS exercise_name, e.unit,
           r.raw_value, r.is_refused, r.notes,
           r.recorded_by, r.recorded_at, r.updated_at
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

function flattenForExport(rows) {
  return rows.map(r => ({
    commission_no:  r.commission_no,
    s_nomer:        r.s_nomer,
    is_n:           r.is_n,
    surname:        r.surname,
    name:           r.name,
    father_name:    r.father_name,
    kodixtisas:     r.kodixtisas,
    ixtisas_name:   r.ixtisas_name,
    exercise_code:  r.exercise_code,
    exercise_name:  r.exercise_name,
    unit:           r.unit,
    raw_value:      r.raw_value,
    is_refused:     r.is_refused,
    notes:          r.notes,
    recorded_by:    r.recorded_by,
    recorded_at:    r.recorded_at,
    updated_at:     r.updated_at,
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
    const ws = XLSX.utils.json_to_sheet(flat);
    XLSX.utils.book_append_sheet(wb, ws, "Results");
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
    const ws = XLSX.utils.json_to_sheet(flat);
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
