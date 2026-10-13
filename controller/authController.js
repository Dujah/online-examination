const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander.js');

 //register

// Shared logic used by both register and createStaff
async function createUserWithRole({ full_name, email, password, role, enrollment_no, semester_id, department_id }) {
  const password_hash = await bcrypt.hash(password, 10);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [userResult] = await connection.query(
      'INSERT INTO user (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [full_name, email, password_hash, role]
    );
    const newUserId = userResult.insertId;

    if (role === 'STUDENT') {
      await connection.query(
        'INSERT INTO student (student_id, enrollment_no, semester_id) VALUES (?, ?, ?)',
        [newUserId, enrollment_no, semester_id]
      );
    } else if (role === 'TEACHER') {
      await connection.query(
        'INSERT INTO teacher (teacher_id, department_id) VALUES (?, ?)',
        [newUserId, department_id]
      );
    }
    // ADMIN needs no second insert

    await connection.commit();
    return { user_id: newUserId, full_name, email, role };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// PUBLIC — anyone can call this, but role is always forced to STUDENT
exports.register = asyncHandler(async (req, res) => {
  const { full_name, email, password, enrollment_no, semester_id } = req.body;

  if (!full_name || !email || !password || !enrollment_no || !semester_id) {
    return res.status(400).json({ error: 'full_name, email, password, enrollment_no, and semester_id are required' });
  }

  try {
    const user = await createUserWithRole({
      full_name, email, password, role: 'STUDENT', enrollment_no, semester_id
    });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email or enrollment number already exists' });
    }
    throw err;
  }
});

// ADMIN-ONLY — creates a TEACHER or ADMIN account. Reachable only via protect + restrictTo('ADMIN')
exports.createStaff = asyncHandler(async (req, res) => {
  const { full_name, email, password, role, department_id } = req.body;

  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ error: 'full_name, email, password, and role are required' });
  }
  if (!['TEACHER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'role must be TEACHER or ADMIN' });
  }
  if (role === 'TEACHER' && !department_id) {
    return res.status(400).json({ error: 'department_id is required for teachers' });
  }

  try {
    const user = await createUserWithRole({ full_name, email, password, role, department_id });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    throw err;
  }
});


// LOGIN
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
  const user = rows[0];

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { user_id: user.user_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  )

    res.cookie('token', token, {
    httpOnly: true,        // JS on the page can't read this cookie
    secure: process.env.NODE_ENV === 'production', // HTTPS-only cookie when deployed
    sameSite: 'lax',       // basic CSRF protection
    maxAge: 24 * 60 * 60 * 1000 // 1 day, in milliseconds
  })

  res.json({
  
    user: { user_id: user.user_id, full_name: user.full_name, role: user.role }
  });
});
// GET current logged-in user's info
exports.getMe = asyncHandler(async (req, res) => {
  // req.user was already attached by the `protect` middleware
  const [rows] = await db.query(
    'SELECT user_id, full_name, email, role FROM user WHERE user_id = ?',
    [req.user.user_id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

// LOGOUT — clear the cookie
exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});