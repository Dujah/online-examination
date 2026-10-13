-- Track whether each answer has been graded.
-- marks_obtained alone can't tell "not graded yet" apart from "graded as 0",
-- and publishing results requires every answer to be graded.
--   MCQ answers and blank THEORY answers are graded automatically on submit.
--   THEORY answers with text are graded by the teacher.
ALTER TABLE scorecard
  ADD COLUMN graded_at DATETIME NULL DEFAULT NULL AFTER marks_obtained;
