// backend/database.js
//
// SQLite bağlantısı. Yol seçimi:
//   • Production (Electron): DB_PATH env-dən gəlir (userData qovluğu)
//   • Development: backend/database.db (layihə kökü)
//
// Mühüm: foreign_keys = ON edirik, çünki SQLite-da default OFF-dir.

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

function resolveDbPath() {
  if (process.env.DB_PATH) {
    const dir = path.dirname(process.env.DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // İlk dəfə yaradılırsa və paketdə seed varsa, onu kopyala
    if (!fs.existsSync(process.env.DB_PATH)) {
      const seed = path.join(__dirname, "database.db");
      if (fs.existsSync(seed)) {
        fs.copyFileSync(seed, process.env.DB_PATH);
        console.log("📦 Seed DB kopyalandı:", process.env.DB_PATH);
      }
    }
    return process.env.DB_PATH;
  }
  return path.join(__dirname, "database.db");
}

const DB_PATH = resolveDbPath();
console.log("🗄️  SQLite path:", DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("DB bağlantı xətası:", err.message);
    return;
  }
  console.log("SQLite bağlandı ✔");
  db.run("PRAGMA foreign_keys = ON;");
  db.run("PRAGMA journal_mode = WAL;");
});

// ─────────── Promise wrapper-lər ───────────
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}
function dbExec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => err ? reject(err) : resolve());
  });
}

module.exports = { db, dbRun, dbGet, dbAll, dbExec, DB_PATH };
