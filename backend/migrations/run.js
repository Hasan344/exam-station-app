// backend/migrations/run.js
//
// Bütün .sql migration fayllarını sırayla icra edir.
// Tracking: migrations_history cədvəlində icra edilmiş fayllar saxlanılır.
//
// İşlət:
//   node backend/migrations/run.js
//   yaxud: npm run migrate (root-da)

const fs = require("fs");
const path = require("path");
const { db, dbAll, dbRun, dbExec } = require("../database");

async function ensureHistoryTable() {
  await dbExec(`
    CREATE TABLE IF NOT EXISTS migrations_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      filename   TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getApplied() {
  const rows = await dbAll("SELECT filename FROM migrations_history");
  return new Set(rows.map(r => r.filename));
}

/**
 * SQL faylını sətir-sətir icra edir, "@optional" şərhi olan ifadələrdə
 * "duplicate column" və oxşar gözlənilən xətaları udur.
 *
 * İstifadə forması:
 *   -- @optional
 *   ALTER TABLE foo ADD COLUMN bar TEXT;
 */
async function runSqlTolerant(sql) {
  // Statement-ləri ayır (sadə split — heç bir mürəkkəb plpgsql triggeri yoxdur)
  const lines = sql.split("\n");
  let buffer = "";
  let optional = false;

  const statements = [];
  for (const ln of lines) {
    if (/^\s*--\s*@optional/i.test(ln)) {
      optional = true;
      continue;
    }
    buffer += ln + "\n";
    if (ln.trim().endsWith(";")) {
      statements.push({ sql: buffer.trim(), optional });
      buffer = "";
      optional = false;
    }
  }
  if (buffer.trim()) statements.push({ sql: buffer.trim(), optional });

  for (const st of statements) {
    if (!st.sql || /^\s*(--.*)?\s*$/.test(st.sql)) continue;
    try {
      await dbExec(st.sql);
    } catch (err) {
      if (st.optional) {
        console.log(`    ↷ optional ötürüldü: ${err.message}`);
      } else {
        throw err;
      }
    }
  }
}

async function run() {
  try {
    await ensureHistoryTable();
    const applied = await getApplied();

    const dir = __dirname;
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("⚠️  Heç bir .sql fayl tapılmadı");
      return;
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  ✓ ${file} (artıq tətbiq edilib)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      console.log(`  ▶ ${file} tətbiq edilir...`);
      await runSqlTolerant(sql);
      await dbRun("INSERT INTO migrations_history (filename) VALUES (?)", [file]);
      console.log(`  ✔ ${file} tamam`);
    }

    console.log("\n✅ Bütün miqrasiyalar uğurla tətbiq edildi");
  } catch (err) {
    console.error("❌ Miqrasiya xətası:", err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

if (require.main === module) run();

module.exports = { run };
