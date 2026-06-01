-- backend/migrations/002_exam_commissions_and_photos.sql
--
-- Köhnə (001-dən sonra) DB-ləri yeni quruluşa gətirir:
--   • exam_commissions pivot cədvəli — hansı komissiya hansı imtahanda?
--   • students.photo_path sütunu (əgər 001-də yoxdursa)
--
-- Yeni qurulan DB-də 001 artıq photo_path-i daxil etdiyi üçün
-- aşağıdakı ALTER TABLE-ı runner try/catch-lə icra edir.

PRAGMA foreign_keys = ON;

-- 1) Exam ↔ Commission pivot
CREATE TABLE IF NOT EXISTS exam_commissions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id       INTEGER NOT NULL,
  commission_no TEXT NOT NULL,
  UNIQUE(exam_id, commission_no),
  FOREIGN KEY (exam_id)       REFERENCES exams(id)                ON DELETE CASCADE,
  FOREIGN KEY (commission_no) REFERENCES commissions(commission_no) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ec_exam       ON exam_commissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_ec_commission ON exam_commissions(commission_no);

-- 2) students.photo_path əlavə et (yoxdursa)
-- @optional — runner bu sətirdəki xətanı udur (sütun artıq var demək olar).
ALTER TABLE students ADD COLUMN photo_path TEXT;
