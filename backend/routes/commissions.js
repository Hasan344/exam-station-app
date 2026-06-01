// backend/routes/commissions.js
//
// Komissiya CRUD + komissiyaya aid hərəkətlər (stansiya seçimi üçün lazımdır).

const express = require("express");
const router = express.Router();
const { dbAll, dbGet, dbRun } = require("../database");

// GET /commissions — bütün komissiyalar (filter ilə)
router.get("/", async (req, res) => {
  try {
    const { sectionId } = req.query;
    const params = [];
    let sql = `
      SELECT c.id, c.commission_no, c.name, c.section_id, s.name AS section_name
      FROM commissions c
      LEFT JOIN sections s ON s.id = c.section_id
    `;
    if (sectionId) {
      sql += " WHERE c.section_id = ?";
      params.push(sectionId);
    }
    sql += " ORDER BY c.commission_no";
    const rows = await dbAll(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /commissions/:commissionNo/exercises
//   → bu komissiyada keçirilən hərəkətlərin siyahısı.
//   AdminSetup səhifəsində "stansiya seçimi" üçün eksik mənbə budur.
router.get("/:commissionNo/exercises", async (req, res) => {
  try {
    const { commissionNo } = req.params;
    const rows = await dbAll(
      `SELECT e.id, e.code, e.name, e.unit, e.direction,
              COALESCE(ce.display_order, e.display_order, e.id) AS display_order
       FROM commission_exercises ce
       JOIN exercises e ON e.id = ce.exercise_id
       WHERE ce.commission_no = ?
       ORDER BY display_order, e.id`,
      [commissionNo]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /commissions/:commissionNo/exercises   body: { exerciseId, displayOrder? }
router.post("/:commissionNo/exercises", async (req, res) => {
  try {
    const { commissionNo } = req.params;
    const { exerciseId, displayOrder } = req.body || {};
    if (!exerciseId) return res.status(400).json({ message: "exerciseId tələb olunur" });

    const comm = await dbGet("SELECT id FROM commissions WHERE commission_no = ?", [commissionNo]);
    if (!comm) return res.status(404).json({ message: "Komissiya tapılmadı" });

    const ex = await dbGet("SELECT id FROM exercises WHERE id = ?", [exerciseId]);
    if (!ex) return res.status(404).json({ message: "Hərəkət tapılmadı" });

    const exists = await dbGet(
      "SELECT id FROM commission_exercises WHERE commission_no = ? AND exercise_id = ?",
      [commissionNo, exerciseId]
    );
    if (exists) return res.status(409).json({ message: "Bu bağlantı artıq mövcuddur" });

    const r = await dbRun(
      `INSERT INTO commission_exercises (commission_no, exercise_id, display_order)
       VALUES (?, ?, ?)`,
      [commissionNo, exerciseId, displayOrder ?? 0]
    );
    res.json({ id: r.lastID, message: "Əlavə edildi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /commissions/:commissionNo/exercises/:exerciseId
router.delete("/:commissionNo/exercises/:exerciseId", async (req, res) => {
  try {
    const { commissionNo, exerciseId } = req.params;
    const r = await dbRun(
      "DELETE FROM commission_exercises WHERE commission_no = ? AND exercise_id = ?",
      [commissionNo, exerciseId]
    );
    if (r.changes === 0) return res.status(404).json({ message: "Bağlantı tapılmadı" });
    res.json({ message: "Silindi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
