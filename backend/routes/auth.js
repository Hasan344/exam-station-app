// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { dbGet } = require("../database");

// POST /auth/login   body: { name, password }
router.post("/login", async (req, res) => {
  try {
    const { name, password } = req.body || {};
    if (!name || !password) {
      return res.status(400).json({ message: "Ad və parol tələb olunur" });
    }
    const row = await dbGet("SELECT * FROM auth_table WHERE name = ?", [name]);
    if (!row) return res.status(401).json({ message: "Ad və ya parol yanlışdır" });

    const match = await bcrypt.compare(password, row.password);
    if (!match) return res.status(401).json({ message: "Ad və ya parol yanlışdır" });

    res.json({ success: true, name: row.name });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /auth/change-password   body: { name, oldPassword, newPassword }
const { dbRun } = require("../database");
router.post("/change-password", async (req, res) => {
  try {
    const { name, oldPassword, newPassword } = req.body || {};
    if (!name || !oldPassword || !newPassword) {
      return res.status(400).json({ message: "Bütün sahələr tələb olunur" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Yeni parol ən azı 6 simvol olmalıdır" });
    }
    const row = await dbGet("SELECT * FROM auth_table WHERE name = ?", [name]);
    if (!row) return res.status(404).json({ message: "İstifadəçi tapılmadı" });

    const ok = await bcrypt.compare(oldPassword, row.password);
    if (!ok) return res.status(401).json({ message: "Cari parol yanlışdır" });

    const newHash = bcrypt.hashSync(newPassword, 10);
    await dbRun("UPDATE auth_table SET password = ? WHERE id = ?", [newHash, row.id]);
    res.json({ success: true, message: "Parol yeniləndi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
