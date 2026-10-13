const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander');

// GET all teachers, with their names (joins teacher + user)
exports.getAllTeachers = asyncHandler(async (req, res) => {
  const [rows] = await db.query(`
    SELECT u.user_id AS teacher_id, u.full_name, u.email, t.department_id
    FROM teacher t
    JOIN user u ON t.teacher_id = u.user_id
  `);
  res.json(rows);
});
