// backend/scripts/hash-password.js
//
// Admin parolu dəyişmək / əlavə etmək üçün CLI:
//   node backend/scripts/hash-password.js admin yeni_parol
//
// Əgər istifadəçi varsa parol yenilənir, yoxsa yaradılır.

const bcrypt = require("bcryptjs");
const { db, dbGet, dbRun } = require("../database");

async function main() {
  const name = process.argv[2];
  const password = process.argv[3];

  if (!name || !password) {
    console.error("İstifadə: node hash-password.js <name> <password>");
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 10);
  const existing = await dbGet("SELECT id FROM auth_table WHERE name = ?", [name]);

  if (existing) {
    await dbRun("UPDATE auth_table SET password = ? WHERE name = ?", [hash, name]);
    console.log(`✔ ${name} üçün parol yeniləndi`);
  } else {
    await dbRun("INSERT INTO auth_table (name, password) VALUES (?, ?)", [name, hash]);
    console.log(`✔ ${name} əlavə edildi`);
  }
  db.close();
}

main().catch(err => {
  console.error("Xəta:", err);
  process.exit(1);
});
