const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const toMinutes = (t) => {
  const [h, m, s = 0] = t.split(':').map(Number);
  return h * 60 + m + s / 60;
};

// Base query: schedule + exam info. Times are compared in SQL (NOW()) so the DB clock is the single source of truth.
const SCHEDULE_SELECT = `
  SELECT es.schedule_id, es.exam_id, DATE_FORMAT(es.exam_date, '%Y-%m-%d') AS exam_date,
         es.start_time, es.end_time, es.is_cancelled,
         e.exam_title, e.duration_minutes, e.semester_id, e.subject_id, e.created_by,
         s.subject_name, sem.semester_number,
         CASE
           WHEN es.is_cancelled THEN 'CANCELLED'
           WHEN NOW() < TIMESTAMP(es.exam_date, es.start_time) THEN 'UPCOMING'
           WHEN NOW() < TIMESTAMP(es.exam_date, es.end_time) THEN 'ONGOING'
           ELSE 'FINISHED'
         END AS status
  FROM exam_schedule es
  JOIN exam e ON e.exam_id = es.exam_id
  JOIN subject s ON s.subject_id = e.subject_id
  JOIN semester sem ON sem.semester_id = e.semester_id
`;

// Loads a schedule and checks the caller may manage it (creator of the exam, or ADMIN).
// Sends the error response and returns null on failure.
async function loadOwnedSchedule(req, res, conn = db) {
  const [rows] = await conn.query(`${SCHEDULE_SELECT} WHERE es.schedule_id = ?`, [req.params.id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Schedule not found' });
    return null;
  }
  const schedule = rows[0];
  if (req.user.role === 'TEACHER' && schedule.created_by !== req.user.user_id) {
    res.status(403).json({ error: 'You can only manage schedules for exams you created' });
    return null;
  }
  return schedule;
}

// Validates date/time input and the exam-specific rules. Returns an error string or null.
// Runs inside the caller's transaction (after the semester row is locked) so the clash check can't race.
async function validateSlot(conn, { exam, exam_date, start_time, end_time, ignoreScheduleId = 0 }) {
  if (!DATE_RE.test(exam_date || '')) return { status: 400, error: 'exam_date must be YYYY-MM-DD' };
  if (!TIME_RE.test(start_time || '') || !TIME_RE.test(end_time || '')) {
    return { status: 400, error: 'start_time and end_time must be HH:MM' };
  }

  const windowMinutes = toMinutes(end_time) - toMinutes(start_time);
  if (windowMinutes <= 0) return { status: 400, error: 'end_time must be after start_time' };
  // Rule: the window must be long enough for a student to use the full exam duration
  if (windowMinutes < exam.duration_minutes) {
    return { status: 400, error: `The window (${windowMinutes} min) is shorter than the exam duration (${exam.duration_minutes} min)` };
  }

  const [[{ valid_date, in_future }]] = await conn.query(
    'SELECT DATE(?) IS NOT NULL AS valid_date, TIMESTAMP(?, ?) > NOW() AS in_future',
    [exam_date, exam_date, start_time]
  );
  if (!valid_date) return { status: 400, error: 'exam_date is not a real date' };
  if (!in_future) return { status: 400, error: 'The exam must start in the future' };

  // Rule: active schedules for the same semester can't overlap — the same students would have to sit both
  const [clash] = await conn.query(`
    SELECT es.schedule_id, e.exam_title, es.start_time, es.end_time
    FROM exam_schedule es JOIN exam e ON e.exam_id = es.exam_id
    WHERE e.semester_id = ? AND es.exam_date = ? AND es.is_cancelled = 0
      AND es.start_time < ? AND es.end_time > ? AND es.schedule_id <> ?
    LIMIT 1
  `, [exam.semester_id, exam_date, end_time, start_time, ignoreScheduleId]);
  if (clash.length) {
    const c = clash[0];
    return { status: 409, error: `Clashes with "${c.exam_title}" (${c.start_time}–${c.end_time}) for the same semester` };
  }
  return null;
}

// Serialises scheduling per semester so two overlapping slots can't both pass the clash check
const lockSemester = (conn, semester_id) =>
  conn.query('SELECT semester_id FROM semester WHERE semester_id = ? FOR UPDATE', [semester_id]);

// GET schedules — teachers see schedules for their own exams, admins see all (optionally filter: ?exam_id=1)
exports.getAllSchedules = asyncHandler(async (req, res) => {
  const conditions = [];
  const params = [];
  if (req.user.role === 'TEACHER') {
    conditions.push('e.created_by = ?');
    params.push(req.user.user_id);
  }
  if (req.query.exam_id) {
    conditions.push('es.exam_id = ?');
    params.push(req.query.exam_id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await db.query(`${SCHEDULE_SELECT} ${where} ORDER BY es.exam_date, es.start_time`, params);
  res.json(rows);
});

// GET one schedule (staff)
exports.getScheduleById = asyncHandler(async (req, res) => {
  const schedule = await loadOwnedSchedule(req, res);
  if (!schedule) return;
  res.json(schedule);
});

// GET upcoming / ongoing exams for the logged-in student's semester
exports.getMySchedules = asyncHandler(async (req, res) => {
  const [rows] = await db.query(`
    ${SCHEDULE_SELECT}
    JOIN student st ON st.semester_id = e.semester_id
    WHERE st.student_id = ? AND e.is_published = 1 AND es.is_cancelled = 0
      AND NOW() < TIMESTAMP(es.exam_date, es.end_time)
    ORDER BY es.exam_date, es.start_time
  `, [req.user.user_id]);
  // Students don't need the internal ownership field
  res.json(rows.map(({ created_by, ...r }) => r));
});

// POST schedule a published exam. Body: { exam_id, exam_date: 'YYYY-MM-DD', start_time: 'HH:MM', end_time: 'HH:MM' }
exports.createSchedule = asyncHandler(async (req, res) => {
  const { exam_id, exam_date, start_time, end_time } = req.body;
  if (!exam_id || !exam_date || !start_time || !end_time) {
    return res.status(400).json({ error: 'exam_id, exam_date, start_time, and end_time are required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [exams] = await connection.query('SELECT * FROM exam WHERE exam_id = ?', [exam_id]);
    if (exams.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Exam not found' });
    }
    const exam = exams[0];
    if (req.user.role === 'TEACHER' && exam.created_by !== req.user.user_id) {
      await connection.rollback();
      return res.status(403).json({ error: 'You can only schedule exams you created' });
    }
    if (!exam.is_published) {
      await connection.rollback();
      return res.status(409).json({ error: 'Only published exams can be scheduled' });
    }

    await lockSemester(connection, exam.semester_id);
    const problem = await validateSlot(connection, { exam, exam_date, start_time, end_time });
    if (problem) {
      await connection.rollback();
      return res.status(problem.status).json({ error: problem.error });
    }

    const [result] = await connection.query(
      'INSERT INTO exam_schedule (exam_id, exam_date, start_time, end_time) VALUES (?, ?, ?, ?)',
      [exam_id, exam_date, start_time, end_time]
    );
    await connection.commit();
    res.status(201).json({ schedule_id: result.insertId, exam_id, exam_date, start_time, end_time, is_cancelled: 0 });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// PUT reschedule — only before the exam has started, and not once cancelled
exports.updateSchedule = asyncHandler(async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const schedule = await loadOwnedSchedule(req, res, connection);
    if (!schedule) {
      await connection.rollback();
      return;
    }
    if (schedule.status !== 'UPCOMING') {
      await connection.rollback();
      return res.status(409).json({ error: `Only upcoming schedules can be changed (this one is ${schedule.status.toLowerCase()})` });
    }

    const slot = {
      exam_date: req.body.exam_date ?? schedule.exam_date,
      start_time: req.body.start_time ?? schedule.start_time,
      end_time: req.body.end_time ?? schedule.end_time
    };

    await lockSemester(connection, schedule.semester_id);
    const problem = await validateSlot(connection, {
      exam: schedule, ...slot, ignoreScheduleId: schedule.schedule_id
    });
    if (problem) {
      await connection.rollback();
      return res.status(problem.status).json({ error: problem.error });
    }

    await connection.query(
      'UPDATE exam_schedule SET exam_date = ?, start_time = ?, end_time = ? WHERE schedule_id = ?',
      [slot.exam_date, slot.start_time, slot.end_time, schedule.schedule_id]
    );
    await connection.commit();
    res.json({ schedule_id: schedule.schedule_id, exam_id: schedule.exam_id, ...slot });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// PATCH cancel — keeps the row (and any student registrations) for the record. Not allowed once finished.
exports.cancelSchedule = asyncHandler(async (req, res) => {
  const schedule = await loadOwnedSchedule(req, res);
  if (!schedule) return;
  if (schedule.status === 'CANCELLED') return res.status(409).json({ error: 'Schedule is already cancelled' });
  if (schedule.status === 'FINISHED') return res.status(409).json({ error: 'A finished exam cannot be cancelled' });

  await db.query('UPDATE exam_schedule SET is_cancelled = 1 WHERE schedule_id = ?', [schedule.schedule_id]);
  res.json({ schedule_id: schedule.schedule_id, is_cancelled: 1 });
});

// DELETE schedule — only while no student is attached, because student_exam rows would cascade away with it
exports.deleteSchedule = asyncHandler(async (req, res) => {
  const schedule = await loadOwnedSchedule(req, res);
  if (!schedule) return;

  const [attempts] = await db.query('SELECT 1 FROM student_exam WHERE schedule_id = ? LIMIT 1', [schedule.schedule_id]);
  if (attempts.length) {
    return res.status(409).json({ error: 'Students are registered for this schedule. Cancel it instead' });
  }

  await db.query('DELETE FROM exam_schedule WHERE schedule_id = ?', [schedule.schedule_id]);
  res.status(204).send();
});
