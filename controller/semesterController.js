const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander');

exports.getAllSemesters = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM semester');
  res.json(rows);
});

exports.getSemesterById = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM semester WHERE semester_id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Semester not found' });
  res.json(rows[0]);
});

exports.createSemester = asyncHandler(async (req, res) => {
  const { semester_number, course_id } = req.body;
  if (!semester_number || !course_id) {
    return res.status(400).json({ error: 'semester_number and course_id are required' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO semester (semester_number, course_id) VALUES (?, ?)',
      [semester_number, course_id]
    );
    res.status(201).json({ semester_id: result.insertId, semester_number, course_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Semester already exists for this course' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'course_id does not exist' });
    }
    // your schema also has chk_sem_number CHECK (1-12) — MySQL 8+ throws ER_CHECK_CONSTRAINT_VIOLATED
    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({ error: 'semester_number must be between 1 and 12' });
    }
    throw err;
  }
});

exports.updateSemester = asyncHandler(async (req, res) => {
  const { semester_number, course_id } = req.body;
  if (!semester_number || !course_id) {
    return res.status(400).json({ error: 'semester_number and course_id are required' });
  }
  try {
    const [result] = await db.query(
      'UPDATE semester SET semester_number = ?, course_id = ? WHERE semester_id = ?',
      [semester_number, course_id, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Semester not found' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Semester already exists for this course' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'course_id does not exist' });
    }
    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({ error: 'semester_number must be between 1 and 12' });
    }
    throw err;
  }
  res.json({ semester_id: req.params.id, semester_number, course_id });
});

exports.deleteSemester = asyncHandler(async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM semester WHERE semester_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Semester not found' });
  } catch (err) {
    // student and exam reference semester with ON DELETE RESTRICT
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Semester still has students or exams' });
    }
    throw err;
  }
  res.status(204).send();
});