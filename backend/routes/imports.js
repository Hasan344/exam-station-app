// backend/routes/imports.js
//
// Excel/CSV idxal endpointləri. Hər endpoint multipart/form-data ilə tək "file" sahəsi gözləyir.
//
//   POST /imports/sections              Sections    (id, name, sect_code)
//   POST /imports/commissions           Commissions (commission_no, name, section_id)
//   POST /imports/exercises             Exercises   (code, name, unit, direction, display_order)
//   POST /imports/commission-exercises  pivot       (commission_no, exercise_code, display_order)
//   POST /imports/exams                 Exams       (name, exam_date, section_id)
//   POST /imports/students              Students    (exam_id, s_nomer, is_n, surname, name, ...)

const express = require("express");
const multer = require("multer");
const router = express.Router();
const { dbGet, dbRun } = require("../database");
const { parseWorkbook, pickField, normalizeDate, runSerial, summarize } = require("../services/excel-helpers");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function readRows(req) {
  if (!req.file) {
    const err = new Error("Fayl yüklənməyib (multipart 'file' sahəsi gözlənilir)");
    err.status = 400;
    throw err;
  }
  return parseWorkbook(req.file.buffer);
}

// ─────────── /imports/sections ───────────
// Sütunlar: id, name, sect_code
router.post("/sections", upload.single("file"), async (req, res) => {
  try {
    const rows = readRows(req);
    if (!rows.length) return res.status(400).json({ message: "Fayl boşdur" });

    const results = await runSerial(rows, async (row) => {
      const idStr = pickField(row, "id", "Id", "ID");
      const name = pickField(row, "name", "Ad", "Name");
      const sect_code = pickField(row, "sect_code", "code", "Kod");
      if (!idStr) throw new Error('"id" boşdur');
      if (!name)  throw new Error('"name" boşdur');
      const id = Number(idStr);
      if (!Number.isInteger(id) || id <= 0) throw new Error("id düzgün tam ədəd deyil");

      await dbRun(
        `INSERT INTO sections (id, name, sect_code) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, sect_code = excluded.sect_code`,
        [id, name, sect_code || null]
      );
      return { id, name };
    });
    res.json(summarize(results, "bölmə"));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ─────────── /imports/commissions ───────────
// Sütunlar: commission_no, name, section_id
router.post("/commissions", upload.single("file"), async (req, res) => {
  try {
    const rows = readRows(req);
    if (!rows.length) return res.status(400).json({ message: "Fayl boşdur" });

    const results = await runSerial(rows, async (row) => {
      const commission_no = pickField(row, "commission_no", "commissionNo", "Komissiya", "no");
      const name = pickField(row, "name", "Ad", "Name");
      const section_id_str = pickField(row, "section_id", "sectionId", "BölməId");
      if (!commission_no) throw new Error('"commission_no" boşdur');
      if (!name)          throw new Error('"name" boşdur');
      if (!section_id_str) throw new Error('"section_id" boşdur');

      const section_id = Number(section_id_str);
      const sec = await dbGet("SELECT id FROM sections WHERE id = ?", [section_id]);
      if (!sec) throw new Error(`section_id=${section_id} mövcud deyil`);

      await dbRun(
        `INSERT INTO commissions (commission_no, name, section_id) VALUES (?, ?, ?)
         ON CONFLICT(commission_no) DO UPDATE SET name = excluded.name, section_id = excluded.section_id`,
        [commission_no, name, section_id]
      );
      return { commission_no };
    });
    res.json(summarize(results, "komissiya"));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ─────────── /imports/exercises ───────────
// Sütunlar: code, name, unit, direction, display_order, notes
router.post("/exercises", upload.single("file"), async (req, res) => {
  try {
    const rows = readRows(req);
    if (!rows.length) return res.status(400).json({ message: "Fayl boşdur" });

    const results = await runSerial(rows, async (row) => {
      const code = pickField(row, "code", "kod");
      const name = pickField(row, "name", "Ad");
      const unit = pickField(row, "unit", "Vahid");
      const directionStr = pickField(row, "direction", "İstiqamət");
      const displayOrderStr = pickField(row, "display_order", "displayOrder", "Sıra");
      const notes = pickField(row, "notes", "Qeyd");

      if (!code) throw new Error('"code" boşdur');
      if (!name) throw new Error('"name" boşdur');
      if (!unit) throw new Error('"unit" boşdur');

      const direction = directionStr ? Number(directionStr) : 1;
      const display_order = displayOrderStr ? Number(displayOrderStr) : 0;

      await dbRun(
        `INSERT INTO exercises (code, name, unit, direction, display_order, notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           name = excluded.name,
           unit = excluded.unit,
           direction = excluded.direction,
           display_order = excluded.display_order,
           notes = excluded.notes`,
        [code, name, unit, direction, display_order, notes || null]
      );
      return { code };
    });
    res.json(summarize(results, "hərəkət"));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ─────────── /imports/commission-exercises ───────────
// Sütunlar: commission_no, exercise_code, display_order
router.post("/commission-exercises", upload.single("file"), async (req, res) => {
  try {
    const rows = readRows(req);
    if (!rows.length) return res.status(400).json({ message: "Fayl boşdur" });

    const results = await runSerial(rows, async (row) => {
      const commission_no = pickField(row, "commission_no", "commissionNo", "Komissiya");
      const exercise_code = pickField(row, "exercise_code", "exerciseCode", "Hərəkət");
      const displayOrderStr = pickField(row, "display_order", "Sıra");

      if (!commission_no) throw new Error('"commission_no" boşdur');
      if (!exercise_code) throw new Error('"exercise_code" boşdur');

      const comm = await dbGet("SELECT id FROM commissions WHERE commission_no = ?", [commission_no]);
      if (!comm) throw new Error(`Komissiya ${commission_no} tapılmadı`);

      const ex = await dbGet("SELECT id FROM exercises WHERE code = ?", [exercise_code]);
      if (!ex) throw new Error(`Hərəkət ${exercise_code} tapılmadı`);

      const display_order = displayOrderStr ? Number(displayOrderStr) : 0;

      await dbRun(
        `INSERT INTO commission_exercises (commission_no, exercise_id, display_order)
         VALUES (?, ?, ?)
         ON CONFLICT(commission_no, exercise_id) DO UPDATE SET
           display_order = excluded.display_order`,
        [commission_no, ex.id, display_order]
      );
      return { commission_no, exercise_code };
    });
    res.json(summarize(results, "bağlantı"));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ─────────── /imports/exams ───────────
// Sütunlar: name, exam_date, section_id, notes, commission_nos
//   commission_nos: vergüllə/nöqtə-vergüllə/boşluqla ayrılmış komissiya nömrələri
//                   (məs. "62, 63, 6401"). Bu sütun varsa, exam_commissions
//                   pivot cədvəlinə avtomatik yazılır.
router.post("/exams", upload.single("file"), async (req, res) => {
  try {
    const rows = readRows(req);
    if (!rows.length) return res.status(400).json({ message: "Fayl boşdur" });

    const results = await runSerial(rows, async (row) => {
      const name = pickField(row, "name", "Name", "Ad");
      const examDateRaw = pickField(row, "exam_date", "examDate", "Date", "Tarix");
      const exam_date = normalizeDate(examDateRaw);
      const section_id_str = pickField(row, "section_id", "sectionId", "BölməId");
      const notes = pickField(row, "notes", "Qeyd");
      const commissionNosRaw = pickField(row, "commission_nos", "commissionNos", "Komissiyalar");

      if (!name) throw new Error('"name" boşdur');
      if (!exam_date) throw new Error('"exam_date" boşdur');

      let section_id = null;
      if (section_id_str) {
        section_id = Number(section_id_str);
        const sec = await dbGet("SELECT id FROM sections WHERE id = ?", [section_id]);
        if (!sec) throw new Error(`section_id=${section_id} mövcud deyil`);
      }

      const r = await dbRun(
        "INSERT INTO exams (name, exam_date, section_id, notes) VALUES (?, ?, ?, ?)",
        [name, exam_date, section_id, notes || null]
      );

      // Əgər commission_nos sütunu doludursa, pivot-a yaz
      const examId = r.lastID;
      const linked = [];
      const skipped = [];
      if (commissionNosRaw) {
        const nos = commissionNosRaw
          .split(/[,;\s]+/)
          .map(s => s.trim())
          .filter(Boolean);
        for (const no of nos) {
          const comm = await dbGet("SELECT id FROM commissions WHERE commission_no = ?", [no]);
          if (!comm) { skipped.push(no); continue; }
          await dbRun(
            "INSERT OR IGNORE INTO exam_commissions (exam_id, commission_no) VALUES (?, ?)",
            [examId, no]
          );
          linked.push(no);
        }
      }

      if (skipped.length > 0) {
        // Toplu xəta üçün throw etmirik — imtahan yarandı, sadəcə komissiya xəbərdarlığı
        throw new Error(`İmtahan yarandı (id=${examId}), amma bu komissiyalar tapılmadı: ${skipped.join(", ")}`);
      }
      return { id: examId, name, linked };
    });
    res.json(summarize(results, "imtahan"));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ─────────── /imports/exam-commissions ───────────
// Komissiya bağlamasını ayrıca idxal etmək üçün
// Sütunlar: exam_id, commission_no
router.post("/exam-commissions", upload.single("file"), async (req, res) => {
  try {
    const rows = readRows(req);
    if (!rows.length) return res.status(400).json({ message: "Fayl boşdur" });

    const results = await runSerial(rows, async (row) => {
      const exam_id_str = pickField(row, "exam_id", "examId");
      const commission_no = pickField(row, "commission_no", "commissionNo", "Komissiya");

      if (!exam_id_str)   throw new Error('"exam_id" boşdur');
      if (!commission_no) throw new Error('"commission_no" boşdur');

      const exam_id = Number(exam_id_str);
      const exam = await dbGet("SELECT id FROM exams WHERE id = ?", [exam_id]);
      if (!exam) throw new Error(`exam_id=${exam_id} mövcud deyil`);

      const comm = await dbGet("SELECT id FROM commissions WHERE commission_no = ?", [commission_no]);
      if (!comm) throw new Error(`Komissiya ${commission_no} tapılmadı`);

      await dbRun(
        "INSERT OR IGNORE INTO exam_commissions (exam_id, commission_no) VALUES (?, ?)",
        [exam_id, commission_no]
      );
      return { exam_id, commission_no };
    });
    res.json(summarize(results, "bağlantı"));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ─────────── /imports/students ───────────
// Sütunlar: exam_id, s_nomer, is_n, surname, name, father_name, birth_date,
//           gender, qrup_num, kodixtisas, ixtisas_name, alt_nov, commission_no
router.post("/students", upload.single("file"), async (req, res) => {
  try {
    const rows = readRows(req);
    if (!rows.length) return res.status(400).json({ message: "Fayl boşdur" });

    const results = await runSerial(rows, async (row, idx) => {
      const exam_id_str = pickField(row, "exam_id", "examId");
      const s_nomer_str = pickField(row, "s_nomer", "sNomer", "SıraNo", "OrderNo");
      const is_n = pickField(row, "is_n", "isN", "İşN");
      const surname = pickField(row, "surname", "Soyad");
      const name = pickField(row, "name", "Ad");
      const father_name = pickField(row, "father_name", "fatherName", "AtaAdi", "Ata adı");
      const birth_date = normalizeDate(pickField(row, "birth_date", "birthDate", "DoğumTarixi"));
      const gender_str = pickField(row, "gender", "Cinsi");
      const qrup_num_str = pickField(row, "qrup_num", "qrupNum", "Qrup");
      const kodixtisas = pickField(row, "kodixtisas", "kod_ixtisas", "İxtisasKodu");
      const ixtisas_name = pickField(row, "ixtisas_name", "ixtisasName", "İxtisas");
      const alt_nov = pickField(row, "alt_nov", "altNov", "AltNöv");
      const commission_no = pickField(row, "commission_no", "commissionNo", "Komissiya");

      if (!exam_id_str)   throw new Error('"exam_id" boşdur');
      if (!is_n)          throw new Error('"is_n" boşdur');
      if (!surname)       throw new Error('"surname" boşdur');
      if (!name)          throw new Error('"name" boşdur');
      if (!commission_no) throw new Error('"commission_no" boşdur');

      const exam_id = Number(exam_id_str);
      const exam = await dbGet("SELECT id FROM exams WHERE id = ?", [exam_id]);
      if (!exam) throw new Error(`exam_id=${exam_id} mövcud deyil`);

      const comm = await dbGet("SELECT id FROM commissions WHERE commission_no = ?", [commission_no]);
      if (!comm) throw new Error(`Komissiya ${commission_no} tapılmadı`);

      // Avtomatik körpü: tələbənin komissiyası bu imtahana hələ təyin olunmayıbsa,
      // əlavə et (idxal ardıcıllığında rahatlıq üçün — student-i idxal etmək
      // həm də komissiyanı imtahana tanıdır)
      await dbRun(
        "INSERT OR IGNORE INTO exam_commissions (exam_id, commission_no) VALUES (?, ?)",
        [exam_id, commission_no]
      );

      const s_nomer = s_nomer_str ? Number(s_nomer_str) : null;
      const gender = gender_str ? Number(gender_str) : null;
      const qrup_num = qrup_num_str ? Number(qrup_num_str) : null;

      await dbRun(
        `INSERT INTO students
           (exam_id, s_nomer, is_n, surname, name, father_name, birth_date, gender,
            qrup_num, kodixtisas, ixtisas_name, alt_nov, commission_no)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(exam_id, is_n) DO UPDATE SET
           s_nomer = excluded.s_nomer,
           surname = excluded.surname,
           name = excluded.name,
           father_name = excluded.father_name,
           birth_date = excluded.birth_date,
           gender = excluded.gender,
           qrup_num = excluded.qrup_num,
           kodixtisas = excluded.kodixtisas,
           ixtisas_name = excluded.ixtisas_name,
           alt_nov = excluded.alt_nov,
           commission_no = excluded.commission_no`,
        [exam_id, s_nomer, is_n, surname, name, father_name || null,
         birth_date || null, gender, qrup_num, kodixtisas || null,
         ixtisas_name || null, alt_nov || null, commission_no]
      );
      return { is_n };
    });
    res.json(summarize(results, "tələbə"));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

module.exports = router;
