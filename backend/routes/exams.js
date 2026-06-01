// backend/routes/exams.js
const express = require("express");
const router = express.Router();
const { dbAll, dbGet, dbRun } = require("../database");

// GET /exams?sectionId=X
router.get("/", async (req, res) => {
  try {
    const { sectionId } = req.query;
    const params = [];
    let sql = `
      SELECT e.id, e.name, e.exam_date, e.section_id, e.notes, e.createdAt,
             s.name AS section_name
      FROM exams e
      LEFT JOIN sections s ON s.id = e.section_id
    `;
    if (sectionId) {
      sql += " WHERE e.section_id = ?";
      params.push(sectionId);
    }
    sql += " ORDER BY e.exam_date DESC, e.id DESC";
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /exams
router.post("/", async (req, res) => {
  try {
    const { name, exam_date, section_id, notes } = req.body || {};
    if (!name || !exam_date) {
      return res.status(400).json({ message: "name və exam_date tələb olunur" });
    }
    const r = await dbRun(
      `INSERT INTO exams (name, exam_date, section_id, notes) VALUES (?, ?, ?, ?)`,
      [name, exam_date, section_id ?? null, notes ?? null]
    );
    res.json({ id: r.lastID });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /exams/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, exam_date, section_id, notes } = req.body || {};
    const r = await dbRun(
      `UPDATE exams
       SET name = COALESCE(?, name),
           exam_date = COALESCE(?, exam_date),
           section_id = COALESCE(?, section_id),
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [name, exam_date, section_id, notes, id]
    );
    if (r.changes === 0) return res.status(404).json({ message: "Tapılmadı" });
    res.json({ message: "Yeniləndi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /exams/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await dbRun("DELETE FROM exams WHERE id = ?", [id]);
    if (r.changes === 0) return res.status(404).json({ message: "Tapılmadı" });
    res.json({ message: "Silindi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /exams/:id/commissions
//   bu imtahanda iştirak edən komissiyalar (SetupPage Step 3 üçün əsas mənbə)
router.get("/:id/commissions", async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT c.id, c.commission_no, c.name, c.section_id
       FROM exam_commissions ec
       JOIN commissions c ON c.commission_no = ec.commission_no
       WHERE ec.exam_id = ?
       ORDER BY c.commission_no`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /exams/:id/commissions   body: { commissionNos: ["62","63"] }
//   imtahana komissiya təyinatlarını toplu yenilə (əvvəlcədən hamısını sil, yenidən qur)
router.post("/:id/commissions", async (req, res) => {
  try {
    const { commissionNos } = req.body || {};
    if (!Array.isArray(commissionNos)) {
      return res.status(400).json({ message: "commissionNos massivi tələb olunur" });
    }
    const examId = req.params.id;

    // Köhnələri sil
    await dbRun("DELETE FROM exam_commissions WHERE exam_id = ?", [examId]);

    // Yeniləri əlavə et — komissiyanın mövcudluğunu yoxla
    let added = 0;
    for (const no of commissionNos) {
      const comm = await dbGet("SELECT id FROM commissions WHERE commission_no = ?", [no]);
      if (!comm) continue;
      await dbRun(
        "INSERT OR IGNORE INTO exam_commissions (exam_id, commission_no) VALUES (?, ?)",
        [examId, no]
      );
      added++;
    }
    res.json({ added });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
