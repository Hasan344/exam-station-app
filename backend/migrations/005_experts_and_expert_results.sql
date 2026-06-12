-- backend/migrations/005_experts_and_expert_results.sql
--
-- Section 3 üçün ekspert bazlı qiymətləndirmə dəstəyi.
--
--   • experts                  — Results App-dan gələn ekspertlərin lokal güzgüsü
--   • exam_expert_subprofession — hansı ekspert hansı imtahanda iştirak edir
--   • student_expert_results   — hər ekspertin hər tələbəyə yazdığı bal (0–100, tam ədəd)
--
-- İdxal (import) növbəti mərhələdə əlavə olunacaq — bu miqrasiya yalnız sxemi qurur.
--
-- Qeyd: əgər əvvəlki 005_exam_expert_subprofession.sql artıq tətbiq olunubsa,
-- aşağıdakı DROP TABLE köhnə (FK-sız) versiyanı silib yenidən yaradır.
-- Cədvəldə hələ data olmadığı üçün təhlükəsizdir.

PRAGMA foreign_keys = ON;

-- ════════════════════════════════════════════════════════════════
-- EKSPERTLƏR (Results App-dan import ediləcək — id mənbə sistemin ID-sidir)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS experts (
  id   INTEGER PRIMARY KEY,                  -- Results App expert ID (AUTOINCREMENT YOX!)
  name TEXT NOT NULL                          -- tam ad (ad / soyad / ata adı birlikdə)
);

-- ════════════════════════════════════════════════════════════════
-- İMTAHAN ↔ EKSPERT (Results App exam_expert_subprofession güzgüsü)
-- ════════════════════════════════════════════════════════════════
-- @optional
DROP TABLE IF EXISTS exam_expert_subprofession;

CREATE TABLE IF NOT EXISTS exam_expert_subprofession (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id   INTEGER NOT NULL,
  expert_id INTEGER NOT NULL,
  UNIQUE(exam_id, expert_id),
  FOREIGN KEY (exam_id)   REFERENCES exams(id)   ON DELETE CASCADE,
  FOREIGN KEY (expert_id) REFERENCES experts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ees_exam   ON exam_expert_subprofession(exam_id);
CREATE INDEX IF NOT EXISTS idx_ees_expert ON exam_expert_subprofession(expert_id);

-- ════════════════════════════════════════════════════════════════
-- EKSPERT NƏTİCƏLƏRİ (section = 3)
-- Hər (tələbə, ekspert) cütü üçün bir bal: 0–100 arası TAM ədəd.
-- Kilid məntiqi student_exam_results ilə eynidir (locked + redaktə parolu).
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS student_expert_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL,
  exam_id     INTEGER NOT NULL,
  expert_id   INTEGER NOT NULL,
  score       INTEGER,                        -- 0–100 tam ədəd (imtina isə NULL)
  is_refused  INTEGER NOT NULL DEFAULT 0,     -- 0/1 — imtina (icra etmədi)
  notes       TEXT,
  recorded_by TEXT,                           -- operator adı (auth_table.name)
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT,
  locked      INTEGER NOT NULL DEFAULT 0,
  UNIQUE(student_id, expert_id),
  CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id)    REFERENCES exams(id)    ON DELETE CASCADE,
  FOREIGN KEY (expert_id)  REFERENCES experts(id)  ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ser_student ON student_expert_results(student_id);
CREATE INDEX IF NOT EXISTS idx_ser_exam    ON student_expert_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_ser_expert  ON student_expert_results(expert_id);

-- updated_at avtomatik (trg_results_update ilə eyni şablon)
CREATE TRIGGER IF NOT EXISTS trg_expert_results_update
AFTER UPDATE ON student_expert_results
FOR EACH ROW
BEGIN
  UPDATE student_expert_results
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.id;
END;
