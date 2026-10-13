const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander');

exports.getAllSubjects = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM subject');
  res.json(rows);
});

exports.getSubjectById = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM subject WHERE subject_id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
  res.json(rows[0]);
});

exports.createSubject = asyncHandler(async (req, res) => {
  const { subject_name, course_id } = req.body;
  if (!subject_name || !course_id) {
    return res.status(400).json({ error: 'subject_name and course_id are required' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO subject (subject_name, course_id) VALUES (?, ?)',
      [subject_name, course_id]
    );
    res.status(201).json({ subject_id: result.insertId, subject_name, course_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Subject already exists in this course' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'course_id does not exist' });
    }
    throw err;
  }
});

exports.updateSubject = asyncHandler(async (req, res) => {
  const { subject_name, course_id } = req.body;
  if (!subject_name?.trim() || !course_id) {
    return res.status(400).json({ error: 'subject_name and course_id are required' });
  }
  try {
    const [result] = await db.query(
      'UPDATE subject SET subject_name = ?, course_id = ? WHERE subject_id = ?',
      [subject_name.trim(), course_id, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Subject not found' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Subject already exists in this course' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'course_id does not exist' });
    }
    throw err;
  }
  res.json({ subject_id: req.params.id, subject_name, course_id });
});

exports.deleteSubject = asyncHandler(async (req, res) => {
  // Rule: deleting a subject would cascade-delete its whole question bank, so require it to be empty first
  const [[{ questions }]] = await db.query('SELECT COUNT(*) AS questions FROM question WHERE subject_id = ?', [req.params.id]);
  if (questions > 0) {
    return res.status(409).json({ error: `Subject still has ${questions} question(s) in its question bank. Delete them first` });
  }
  try {
    const [result] = await db.query('DELETE FROM subject WHERE subject_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Subject not found' });
  } catch (err) {
    // exam references subject with ON DELETE RESTRICT
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Subject still has exams. Delete them first' });
    }
    throw err;
  }
  res.status(204).send();
});