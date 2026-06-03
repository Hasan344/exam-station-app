-- backend/migrations/003_result_lock_and_edit_password.sql
--
-- İki yeni tələbi dəstəkləyir:
--   1) Saxlanılan hər nəticə KİLİDLƏNİR (locked=1) → adi formada dəyişdirilə bilməz.
--   2) Kilidli nəticəni dəyişmək üçün lazım olan "redaktə parolu" bazada saxlanılır
--      (app_settings cədvəlində, bcrypt hash kimi).
--
-- Qeyd: runner statement-ləri ";" ilə ayırır, "-- @optional" şərhi olan ifadədə
-- gözlənilən xətanı (məs. "duplicate column") udur.

PRAGMA foreign_keys = ON;

-- 1) student_exam_results.locked
-- @optional
ALTER TABLE student_exam_results ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;

-- 2) Artıq mövcud (bu miqrasiyadan əvvəl yazılmış) nəticələri də kilidlə.
--    İstəmirsinizsə bu sətri silə bilərsiniz.
UPDATE student_exam_results SET locked = 1 WHERE locked = 0;

-- 3) Tətbiq parametrləri (key-value). Redaktə parolu burada saxlanılır.
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
