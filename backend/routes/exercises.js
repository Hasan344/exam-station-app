// backend/routes/exercises.js
const express = require("express");
const router = express.Router();
const { dbAll, dbGet, dbRun } = require("../database");

// GET /exercises — bütün hərəkətlər
router.get("/", async (_req, res) => {
  try {
    const rows = await dbAll(
      `SELECT id, code, name, unit, direction, display_order, notes
       FROM exercises
       ORDER BY display_order, id`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /exercises
router.post("/", async (req, res) => {
  try {
    const { code, name, unit, direction = 1, display_order = 0, notes } = req.body || {};
    if (!code || !name || !unit) {
      return res.status(400).json({ message: "code, name, unit tələb olunur" });
    }
    const r = await dbRun(
      `INSERT INTO exercises (code, name, unit, direction, display_order, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [code, name, unit, direction, display_order, notes ?? null]
    );
    res.json({ id: r.lastID });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /exercises/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, unit, direction, display_order, notes } = req.body || {};
    const r = await dbRun(
      `UPDATE exercises
       SET code = COALESCE(?, code),
           name = COALESCE(?, name),
           unit = COALESCE(?, unit),
           direction = COALESCE(?, direction),
           display_order = COALESCE(?, display_order),
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [code, name, unit, direction, display_order, notes, id]
    );
    if (r.changes === 0) return res.status(404).json({ message: "Tapılmadı" });
    res.json({ message: "Yeniləndi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /exercises/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await dbRun("DELETE FROM exercises WHERE id = ?", [id]);
    if (r.changes === 0) return res.status(404).json({ message: "Tapılmadı" });
    res.json({ message: "Silindi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
