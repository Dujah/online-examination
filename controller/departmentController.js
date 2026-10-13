const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander');

// GET all departments
exports.getAllDepartments = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM department');
  res.json(rows);
});

// GET one department
exports.getDepartmentById = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM department WHERE department_id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Department not found' });
  res.json(rows[0]);
});

// POST create department
exports.createDepartment = asyncHandler(async (req, res) => {
  const { department_name } = req.body;
  if (!department_name) return res.status(400).json({ error: 'department_name is required' });

  try {
    const [result] = await db.query(
      'INSERT INTO department (department_name) VALUES (?)',
      [department_name]
    );
    res.status(201).json({ department_id: result.insertId, department_name });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Department already exists' });
    }
    throw err;
  }
});

// PUT update department
exports.updateDepartment = asyncHandler(async (req, res) => {
  const { department_name } = req.body;
 const departmentName = department_name?.trim();
if (!departmentName) {
  return res.status(400).json({ error: 'department_name is required' });
}
  try {
    const [result] = await db.query(
      'UPDATE department SET department_name = ? WHERE department_id = ?',
      [departmentName, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Department not found' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Department already exists' });
    }
    throw err;
  }
  res.json({ department_id: req.params.id, department_name: departmentName });
});

// DELETE department
exports.deleteDepartment = asyncHandler(async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM department WHERE department_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Department not found' });
  } catch (err) {
    // course and teacher reference department with ON DELETE RESTRICT
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Department still has courses or teachers. Remove or move them first' });
    }
    throw err;
  }
  res.status(204).send(); // 204 = success, no content to return
});
