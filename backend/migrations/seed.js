// backend/migrations/seed.js
//
// İlkin məlumatları yükləyir (idempotent):
//   • admin/admin123 (yalnız əgər auth_table boşdursa)
//   • bir neçə nümunə section + exercise (yalnız əgər müvafiq cədvəl boşdursa)
//
// Excel-dən real məlumat sonradan idxal olunacaq, bu yalnız ilk açılış üçün.
//
// İşlət:
//   node backend/migrations/seed.js
//   npm run seed

const bcrypt = require("bcryptjs");
const { db, dbAll, dbGet, dbRun } = require("../database");

async function seedAdmin() {
  const row = await dbGet("SELECT COUNT(*) AS n FROM auth_table");
  if (row && row.n > 0) {
    console.log("  ✓ auth_table-da artıq istifadəçi var, ötürülür");
    return;
  }
  const hash = bcrypt.hashSync("admin123", 10);
  await dbRun("INSERT INTO auth_table (name, password) VALUES (?, ?)", ["admin", hash]);
  console.log("  ✔ admin/admin123 əlavə edildi (PRODUKSİYAYA ÇIXARMADAN ƏVVƏL DƏYİŞ!)");
}

async function seedSections() {
  const row = await dbGet("SELECT COUNT(*) AS n FROM sections");
  if (row && row.n > 0) {
    console.log("  ✓ sections-da artıq qeydlər var, ötürülür");
    return;
  }
  const sections = [
    { id: 1, name: "Bölmə 1 — Bədən tərbiyəsi",  sect_code: "BT" },
    { id: 2, name: "Bölmə 2 — Hərbi hazırlıq",   sect_code: "HH" },
    { id: 3, name: "Bölmə 3 — Ekspert qiyməti",  sect_code: "EQ" },
  ];
  for (const s of sections) {
    await dbRun(
      "INSERT INTO sections (id, name, sect_code) VALUES (?, ?, ?)",
      [s.id, s.name, s.sect_code]
    );
  }
  console.log(`  ✔ ${sections.length} bölmə əlavə edildi`);
}

async function seedExercises() {
  const row = await dbGet("SELECT COUNT(*) AS n FROM exercises");
  if (row && row.n > 0) {
    console.log("  ✓ exercises-da artıq qeydlər var, ötürülür");
    return;
  }
  const exercises = [
    { code: "sprint_100m", name: "100 metr qaçış",       unit: "second", direction: 1, display_order: 1 },
    { code: "cross_1000m", name: "1000 metr qaçış",      unit: "second", direction: 1, display_order: 2 },
    { code: "long_jump",   name: "Uzunluğa tullanma",    unit: "cm",     direction: 2, display_order: 3 },
    { code: "pullup",      name: "Dartınma",             unit: "count",  direction: 2, display_order: 4 },
    { code: "pushup",      name: "Şəkillənmə",           unit: "count",  direction: 2, display_order: 5 },
    { code: "shuttle",     name: "Mövçük qaçış",         unit: "second", direction: 1, display_order: 6 },
  ];
  for (const e of exercises) {
    await dbRun(
      `INSERT INTO exercises (code, name, unit, direction, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [e.code, e.name, e.unit, e.direction, e.display_order]
    );
  }
  console.log(`  ✔ ${exercises.length} hərəkət əlavə edildi`);
}

async function seedDemoCommissions() {
  const row = await dbGet("SELECT COUNT(*) AS n FROM commissions");
  if (row && row.n > 0) {
    console.log("  ✓ commissions-da artıq qeydlər var, ötürülür");
    return;
  }

  // Demo: 2 komissiya, hər birinə bir neçə hərəkət təyin et
  const demo = [
    { commission_no: "62", name: "Komissiya 62 (qısa qaçış + tullanma)",  section_id: 1,
      exercise_codes: ["sprint_100m", "long_jump", "pullup"] },
    { commission_no: "63", name: "Komissiya 63 (uzun qaçış + güc)",       section_id: 1,
      exercise_codes: ["cross_1000m", "pullup", "pushup"] },
  ];

  for (const c of demo) {
    await dbRun(
      "INSERT INTO commissions (commission_no, name, section_id) VALUES (?, ?, ?)",
      [c.commission_no, c.name, c.section_id]
    );
    let order = 1;
    for (const code of c.exercise_codes) {
      const ex = await dbGet("SELECT id FROM exercises WHERE code = ?", [code]);
      if (!ex) continue;
      await dbRun(
        `INSERT INTO commission_exercises (commission_no, exercise_id, display_order)
         VALUES (?, ?, ?)`,
        [c.commission_no, ex.id, order++]
      );
    }
  }
  console.log(`  ✔ ${demo.length} demo komissiya + hərəkət təyinatı`);
}

async function seedDemoExam() {
  const row = await dbGet("SELECT COUNT(*) AS n FROM exams");
  if (row && row.n > 0) {
    console.log("  ✓ exams-da artıq qeyd var, ötürülür");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const r = await dbRun(
    "INSERT INTO exams (name, exam_date, section_id) VALUES (?, ?, ?)",
    ["Demo imtahan", today, 1]
  );
  const examId = r.lastID;

  // Komissiyaları bu imtahana təyin et (62 və 63 demo-da var)
  for (const no of ["62", "63"]) {
    await dbRun(
      "INSERT OR IGNORE INTO exam_commissions (exam_id, commission_no) VALUES (?, ?)",
      [examId, no]
    );
  }
  console.log(`  ✔ 1 demo imtahan (id=${examId}) + 2 komissiya təyinatı`);
}

async function run() {
  try {
    console.log("\n📥 Seed başladı...\n");
    await seedAdmin();
    await seedSections();
    await seedExercises();
    await seedDemoCommissions();
    await seedDemoExam();
    console.log("\n✅ Seed tamam.\n");
  } catch (err) {
    console.error("\n❌ Seed xətası:", err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

if (require.main === module) run();

module.exports = { run };
