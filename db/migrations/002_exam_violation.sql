-- Times a student left the exam screen during an attempt (switched tab or window, or left fullscreen).
-- The exam page reports each one; after the limit the server submits the attempt.
-- Teachers see the count and times on the results and grading pages.
CREATE TABLE exam_violation (
  violation_id INT NOT NULL AUTO_INCREMENT,
  student_exam_id INT NOT NULL,
  violation_type ENUM('TAB_HIDDEN', 'WINDOW_BLUR', 'FULLSCREEN_EXIT') NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (violation_id),
  KEY idx_violation_attempt (student_exam_id),
  CONSTRAINT fk_violation_attempt FOREIGN KEY (student_exam_id)
    REFERENCES student_exam (student_exam_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
