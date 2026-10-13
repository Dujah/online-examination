const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander');

exports.getAllCourses = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM course');
  res.json(rows);
});

exports.getCourseById = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM course WHERE course_id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Course not found' });
  res.json(rows[0]);
});

exports.createCourse = asyncHandler(async (req, res) => {
  const { course_name, department_id } = req.body;
  if (!course_name || !department_id) {
    return res.status(400).json({ error: 'course_name and department_id are required' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO course (course_name, department_id) VALUES (?, ?)',
      [course_name, department_id]
    );
    res.status(201).json({ course_id: result.insertId, course_name, department_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Course already exists in this department' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'department_id does not exist' });
    }
    throw err;
  }
});

exports.updateCourse = asyncHandler(async (req, res) => {
  const { course_name, department_id } = req.body;
  if (!course_name?.trim() || !department_id) {
    return res.status(400).json({ error: 'course_name and department_id are required' });
  }
  try {
    const [result] = await db.query(
      'UPDATE course SET course_name = ?, department_id = ? WHERE course_id = ?',
      [course_name.trim(), department_id, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Course not found' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Course already exists in this department' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'department_id does not exist' });
    }
    throw err;
  }
  res.json({ course_id: req.params.id, course_name, department_id });
});

exports.deleteCourse = asyncHandler(async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM course WHERE course_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Course not found' });
  } catch (err) {
    // subject and semester reference course with ON DELETE RESTRICT
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Course still has subjects or semesters. Remove them first' });
    }
    throw err;
  }
  res.status(204).send();
});