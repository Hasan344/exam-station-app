-- backend/migrations/004_appeal.sql
--
-- Apellyasiya (appeal) dəstəyi.
-- Eyni (student, exercise) sətrinə apellyasiya qiyməti yazılır.
-- Apellyasiya mövcuddursa, nəticələrdə narıncı rəngdə göstərilir.
--
-- Məntiq nəticə yığımı ilə eynidir: apellyasiya saxlanılanda kilidlənir
-- (appeal_locked=1) və dəyişmək üçün eyni "redaktə parolu" tələb olunur.

PRAGMA foreign_keys = ON;

-- @optional
ALTER TABLE student_exam_results ADD COLUMN appeal_value REAL;
-- @optional
ALTER TABLE student_exam_results ADD COLUMN appeal_is_refused INTEGER NOT NULL DEFAULT 0;
-- @optional
ALTER TABLE student_exam_results ADD COLUMN appeal_notes TEXT;
-- @optional
ALTER TABLE student_exam_results ADD COLUMN appeal_recorded_by TEXT;
-- @optional
ALTER TABLE student_exam_results ADD COLUMN appeal_recorded_at TEXT;
-- @optional
ALTER TABLE student_exam_results ADD COLUMN appeal_locked INTEGER NOT NULL DEFAULT 0;
