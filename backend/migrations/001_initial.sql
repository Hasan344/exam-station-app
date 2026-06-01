-- backend/migrations/001_initial.sql
-- Exam Station DB sxeması.
-- Bal hesablama yoxdur — yalnız raw_value yığılır.
-- Bir tələbə bir neçə hərəkət üzrə bal sahibi ola bilər (student_exam_results).

PRAGMA foreign_keys = ON;

-- ════════════════════════════════════════════════════════════════
-- AUTH
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS auth_table (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT UNIQUE NOT NULL,
  password  TEXT NOT NULL,                    -- bcrypt hash
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ════════════════════════════════════════════════════════════════
-- TƏŞKİLATİ STRUKTUR
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sections (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  sect_code TEXT
);

CREATE TABLE IF NOT EXISTS commissions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  commission_no TEXT UNIQUE NOT NULL,         -- '62', '63', '6401'
  name          TEXT NOT NULL,
  section_id    INTEGER NOT NULL,
  FOREIGN KEY (section_id) REFERENCES sections(id)
);

CREATE INDEX IF NOT EXISTS idx_commissions_section ON commissions(section_id);

-- ════════════════════════════════════════════════════════════════
-- HƏRƏKƏTLƏR (kataloq)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS exercises (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT UNIQUE NOT NULL,         -- 'sprint_100m'
  name          TEXT NOT NULL,                -- '100 metr qaçış'
  unit          TEXT NOT NULL,                -- 'second' | 'cm' | 'count' | 'score'
  direction     INTEGER NOT NULL DEFAULT 1,   -- 1 = az = yaxşı, 2 = çox = yaxşı
  display_order INTEGER DEFAULT 0,
  notes         TEXT
);

-- ════════════════════════════════════════════════════════════════
-- KOMISSIYA ↔ HƏRƏKƏT (çoxa-çox)
-- Əsas körpü: hansı hərəkət hansı komissiyada keçirilir
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS commission_exercises (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  commission_no TEXT NOT NULL,
  exercise_id   INTEGER NOT NULL,
  display_order INTEGER DEFAULT 0,
  UNIQUE(commission_no, exercise_id),
  FOREIGN KEY (commission_no) REFERENCES commissions(commission_no) ON UPDATE CASCADE,
  FOREIGN KEY (exercise_id)   REFERENCES exercises(id)              ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ce_commission ON commission_exercises(commission_no);
CREATE INDEX IF NOT EXISTS idx_ce_exercise   ON commission_exercises(exercise_id);

-- ════════════════════════════════════════════════════════════════
-- İMTAHANLAR
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS exams (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,                   -- 'Yay 2025 Buraxılış'
  exam_date  TEXT NOT NULL,                   -- 'YYYY-MM-DD'
  section_id INTEGER,
  notes      TEXT,
  createdAt  TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (section_id) REFERENCES sections(id)
);

CREATE INDEX IF NOT EXISTS idx_exams_section ON exams(section_id);
CREATE INDEX IF NOT EXISTS idx_exams_date    ON exams(exam_date);

-- ════════════════════════════════════════════════════════════════
-- TƏLƏBƏLƏR (Excel-dən import edilir)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS students (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id       INTEGER NOT NULL,
  s_nomer       INTEGER,                      -- sıra nömrəsi (komissiya daxilində)
  is_n          TEXT NOT NULL,                -- unikal abituriyent kodu
  surname       TEXT NOT NULL,
  name          TEXT NOT NULL,
  father_name   TEXT,
  birth_date    TEXT,                         -- 'YYYY-MM-DD'
  gender        INTEGER,                      -- 1 = kişi, 2 = qadın
  qrup_num      INTEGER,
  kodixtisas    TEXT,
  ixtisas_name  TEXT,
  alt_nov       TEXT,
  commission_no TEXT NOT NULL,
  photo_path    TEXT,                          -- nisbi yol, userData/photos/-dən
  UNIQUE(exam_id, is_n),
  FOREIGN KEY (exam_id)       REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (commission_no) REFERENCES commissions(commission_no)
);

CREATE INDEX IF NOT EXISTS idx_students_commission ON students(commission_no, exam_id);
CREATE INDEX IF NOT EXISTS idx_students_snomer     ON students(exam_id, commission_no, s_nomer);

-- ════════════════════════════════════════════════════════════════
-- NƏTİCƏLƏR (raw value yığımı — bal hesablama yox!)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS student_exam_results (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL,
  exam_id      INTEGER NOT NULL,
  exercise_id  INTEGER NOT NULL,
  raw_value    REAL,                          -- xam dəyər (saniyə, sm, count, ...)
  is_refused   INTEGER DEFAULT 0,             -- 0/1 — imtina (icra etmədi)
  notes        TEXT,
  recorded_by  TEXT,                          -- operator adı (auth_table.name)
  recorded_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT,
  UNIQUE(student_id, exercise_id),
  FOREIGN KEY (student_id)  REFERENCES students(id)  ON DELETE CASCADE,
  FOREIGN KEY (exam_id)     REFERENCES exams(id)     ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_results_student  ON student_exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_exam     ON student_exam_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_results_exercise ON student_exam_results(exercise_id);

-- ════════════════════════════════════════════════════════════════
-- TRIGGER-LƏR: updated_at avtomatik
-- ════════════════════════════════════════════════════════════════
CREATE TRIGGER IF NOT EXISTS trg_results_update
AFTER UPDATE ON student_exam_results
FOR EACH ROW
BEGIN
  UPDATE student_exam_results
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.id;
END;
