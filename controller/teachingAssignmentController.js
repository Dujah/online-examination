const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander');

exports.getAllAssignments = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM teaching_assignment');
  res.json(rows);
});

exports.getAssignmentById = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM teaching_assignment WHERE assignment_id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
  res.json(rows[0]);
});

exports.createAssignment = asyncHandler(async (req, res) => {
  const { teacher_id, subject_id } = req.body;
  if (!teacher_id || !subject_id) {
    return res.status(400).json({ error: 'teacher_id and subject_id are required' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO teaching_assignment (teacher_id, subject_id) VALUES (?, ?)',
      [teacher_id, subject_id]
    );
    res.status(201).json({ assignment_id: result.insertId, teacher_id, subject_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This teacher is already assigned to this subject' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'teacher_id or subject_id does not exist' });
    }
    throw err;
  }
});

exports.deleteAssignment = asyncHandler(async (req, res) => {
  const [result] = await db.query('DELETE FROM teaching_assignment WHERE assignment_id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Assignment not found' });
  res.status(204).send();
});

exports.getMyAssignments = asyncHandler(async (req, res) => {
  const [rows] = await db.query(`
    SELECT ta.assignment_id, ta.subject_id, s.subject_name, s.course_id
    FROM teaching_assignment ta
    JOIN subject s ON ta.subject_id = s.subject_id
    WHERE ta.teacher_id = ?
  `, [req.user.user_id]);
  res.json(rows);
});