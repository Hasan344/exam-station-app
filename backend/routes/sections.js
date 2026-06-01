// backend/routes/sections.js
const express = require("express");
const router = express.Router();
const { dbAll } = require("../database");

// GET /sections — bütün bölmələr
router.get("/", async (_req, res) => {
  try {
    const rows = await dbAll("SELECT id, name, sect_code FROM sections ORDER BY id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /sections/:id/commissions — bölməyə aid komissiyalar
router.get("/:id/commissions", async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await dbAll(
      `SELECT id, commission_no, name, section_id
       FROM commissions
       WHERE section_id = ?
       ORDER BY commission_no`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
