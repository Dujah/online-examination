const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander');

// Lifecycle: an exam starts as a draft (is_published = 0) where its settings and questions can change freely.
// Publishing locks it. It can only be unpublished again while no schedule exists for it.

// Loads an exam and checks the caller may manage it. Sends the error response and returns null on failure.
// Pass a transaction connection + forUpdate=true to lock the row while editing.
async function loadOwnedExam(req, res, conn = db, forUpdate = false) {
  const [rows] = await conn.query(
    `SELECT * FROM exam WHERE exam_id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [req.params.id]
  );
  if (rows.length === 0) {
    res.status(404).json({ error: 'Exam not found' });
    return null;
  }
  const exam = rows[0];
  // Rule: a TEACHER can only manage exams they created. ADMIN bypasses this check.
  if (req.user.role === 'TEACHER' && exam.created_by !== req.user.user_id) {
    res.status(403).json({ error: 'You can only manage exams you created' });
    return null;
  }
  return exam;
}

// Same as loadOwnedExam, but also requires the exam to still be a draft
async function loadEditableExam(req, res, conn = db, forUpdate = false) {
  const exam = await loadOwnedExam(req, res, conn, forUpdate);
  if (!exam) return null;
  if (exam.is_published) {
    res.status(409).json({ error: 'Exam is published. Unpublish it before making changes' });
    return null;
  }
  return exam;
}

// Rule: the semester must belong to the same course as the subject
async function semesterMatchesSubject(semester_id, subject_id) {
  const [rows] = await db.query(
    `SELECT 1 FROM semester sem JOIN subject sub ON sub.course_id = sem.course_id
     WHERE sem.semester_id = ? AND sub.subject_id = ?`,
    [semester_id, subject_id]
  );
  return rows.length > 0;
}

function validateSettings({ exam_title, duration_minutes, passing_marks }) {
  if (exam_title !== undefined && !String(exam_title).trim()) return 'exam_title cannot be empty';
  if (duration_minutes !== undefined && !(Number.isInteger(Number(duration_minutes)) && Number(duration_minutes) > 0)) {
    return 'duration_minutes must be a whole number greater than 0';
  }
  if (passing_marks !== undefined && !(Number(passing_marks) >= 0)) return 'passing_marks must be 0 or more';
  return null;
}

// GET exams — teachers see their own, admins see all (optionally filter: /api/exams?subject_id=1)
exports.getAllExams = asyncHandler(async (req, res) => {
  const conditions = [];
  const params = [];
  if (req.user.role === 'TEACHER') {
    conditions.push('e.created_by = ?');
    params.push(req.user.user_id);
  }
  if (req.query.subject_id) {
    conditions.push('e.subject_id = ?');
    params.push(req.query.subject_id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(`
    SELECT e.*, s.subject_name, sem.semester_number,
           COALESCE(t.total_questions, 0) AS total_questions,
           COALESCE(t.total_marks, 0) AS total_marks
    FROM exam e
    JOIN subject s ON s.subject_id = e.subject_id
    JOIN semester sem ON sem.semester_id = e.semester_id
    LEFT JOIN vw_exam_total_marks t ON t.exam_id = e.exam_id
    ${where}
    ORDER BY e.created_at DESC
  `, params);
  res.json(rows);
});

// GET one exam WITH its ordered questions (and MCQ options, including the correct answer — staff only)
exports.getExamById = asyncHandler(async (req, res) => {
  const exam = await loadOwnedExam(req, res);
  if (!exam) return;

  const [questions] = await db.query(`
    SELECT eq.sequence_no, q.question_id, q.question_text, q.question_type, q.marks
    FROM exam_question eq
    JOIN question q ON q.question_id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.sequence_no
  `, [exam.exam_id]);

  const mcqIds = questions.filter(q => q.question_type === 'MCQ').map(q => q.question_id);
  if (mcqIds.length) {
    const [options] = await db.query(
      'SELECT option_id, question_id, option_text, is_correct, display_order FROM option_choice WHERE question_id IN (?) ORDER BY display_order',
      [mcqIds]
    );
    questions.forEach(q => {
      if (q.question_type === 'MCQ') q.options = options.filter(o => o.question_id === q.question_id);
    });
  }

  exam.questions = questions;
  exam.total_questions = questions.length;
  exam.total_marks = questions.reduce((sum, q) => sum + Number(q.marks), 0);
  res.json(exam);
});

// POST create a draft exam (questions are added afterwards via PUT /:id/questions)
exports.createExam = asyncHandler(async (req, res) => {
  const { subject_id, semester_id, exam_title, duration_minutes, passing_marks, randomize_questions } = req.body;
  const created_by = req.user.user_id;

  if (!subject_id || !semester_id || !exam_title || !duration_minutes) {
    return res.status(400).json({ error: 'subject_id, semester_id, exam_title, and duration_minutes are required' });
  }
  const invalid = validateSettings({ exam_title, duration_minutes, passing_marks });
  if (invalid) return res.status(400).json({ error: invalid });

  // Rule: a TEACHER can only create exams for a subject they're assigned to. ADMIN bypasses this check.
  if (req.user.role === 'TEACHER') {
    const [assignment] = await db.query(
      'SELECT 1 FROM teaching_assignment WHERE teacher_id = ? AND subject_id = ?',
      [created_by, subject_id]
    );
    if (assignment.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject' });
    }
  }

  if (!(await semesterMatchesSubject(semester_id, subject_id))) {
    return res.status(400).json({ error: 'Semester and subject must exist and belong to the same course' });
  }

  const [result] = await db.query(
    `INSERT INTO exam (subject_id, semester_id, created_by, exam_title, duration_minutes, passing_marks, randomize_questions)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [subject_id, semester_id, created_by, String(exam_title).trim(), duration_minutes,
     passing_marks || 0, randomize_questions === undefined ? true : !!randomize_questions]
  );
  res.status(201).json({ exam_id: result.insertId, subject_id, semester_id, exam_title, is_published: 0 });
});

// PUT update draft exam settings (partial updates allowed). subject_id can't change — the questions belong to it.
exports.updateExam = asyncHandler(async (req, res) => {
  const exam = await loadEditableExam(req, res);
  if (!exam) return;

  if (req.body.subject_id !== undefined && Number(req.body.subject_id) !== exam.subject_id) {
    return res.status(400).json({ error: 'subject_id cannot be changed. Create a new exam instead' });
  }
  const invalid = validateSettings(req.body);
  if (invalid) return res.status(400).json({ error: invalid });

  const updated = {
    exam_title: req.body.exam_title !== undefined ? String(req.body.exam_title).trim() : exam.exam_title,
    semester_id: req.body.semester_id ?? exam.semester_id,
    duration_minutes: req.body.duration_minutes ?? exam.duration_minutes,
    passing_marks: req.body.passing_marks ?? exam.passing_marks,
    randomize_questions: req.body.randomize_questions !== undefined ? !!req.body.randomize_questions : !!exam.randomize_questions
  };

  if (Number(updated.semester_id) !== exam.semester_id && !(await semesterMatchesSubject(updated.semester_id, exam.subject_id))) {
    return res.status(400).json({ error: 'Semester must exist and belong to the same course as the subject' });
  }

  await db.query(
    `UPDATE exam SET exam_title = ?, semester_id = ?, duration_minutes = ?, passing_marks = ?, randomize_questions = ?
     WHERE exam_id = ?`,
    [updated.exam_title, updated.semester_id, updated.duration_minutes, updated.passing_marks, updated.randomize_questions, exam.exam_id]
  );
  res.json({ exam_id: exam.exam_id, ...updated });
});

// PUT replace the exam's question list. Body: { question_ids: [5, 2, 9] } — array order becomes sequence_no 1..n
exports.setExamQuestions = asyncHandler(async (req, res) => {
  const { question_ids } = req.body;
  if (!Array.isArray(question_ids)) {
    return res.status(400).json({ error: 'question_ids must be an array' });
  }
  const ids = question_ids.map(Number);
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) {
    return res.status(400).json({ error: 'question_ids must contain valid question IDs' });
  }
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: 'A question can only appear once in an exam' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Lock the exam row so a concurrent publish can't slip in between the check and the write
    const exam = await loadEditableExam(req, res, connection, true);
    if (!exam) {
      await connection.rollback();
      return;
    }

    // Rule: every question must exist and belong to the exam's subject
    if (ids.length) {
      const [found] = await connection.query(
        'SELECT question_id FROM question WHERE question_id IN (?) AND subject_id = ?',
        [ids, exam.subject_id]
      );
      if (found.length !== ids.length) {
        const foundIds = new Set(found.map(r => r.question_id));
        const bad = ids.filter(id => !foundIds.has(id));
        await connection.rollback();
        return res.status(400).json({ error: `Questions not found in this exam's subject: ${bad.join(', ')}` });
      }
    }

    await connection.query('DELETE FROM exam_question WHERE exam_id = ?', [exam.exam_id]);
    if (ids.length) {
      await connection.query(
        'INSERT INTO exam_question (exam_id, question_id, sequence_no) VALUES ?',
        [ids.map((id, i) => [exam.exam_id, id, i + 1])]
      );
    }

    const [[totals]] = await connection.query(
      'SELECT COUNT(*) AS total_questions, COALESCE(SUM(q.marks), 0) AS total_marks FROM exam_question eq JOIN question q ON q.question_id = eq.question_id WHERE eq.exam_id = ?',
      [exam.exam_id]
    );

    await connection.commit();
    res.json({ exam_id: exam.exam_id, question_ids: ids, ...totals });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// PATCH publish — locks the exam. Needs at least one question and passing_marks within the total.
exports.publishExam = asyncHandler(async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const exam = await loadOwnedExam(req, res, connection, true);
    if (!exam) {
      await connection.rollback();
      return;
    }
    if (exam.is_published) {
      await connection.rollback();
      return res.status(409).json({ error: 'Exam is already published' });
    }

    const [[totals]] = await connection.query(
      'SELECT COUNT(*) AS total_questions, COALESCE(SUM(q.marks), 0) AS total_marks FROM exam_question eq JOIN question q ON q.question_id = eq.question_id WHERE eq.exam_id = ?',
      [exam.exam_id]
    );
    if (totals.total_questions === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Add at least one question before publishing' });
    }
    if (Number(exam.passing_marks) > Number(totals.total_marks)) {
      await connection.rollback();
      return res.status(400).json({ error: `Passing marks (${exam.passing_marks}) exceed the exam total (${totals.total_marks})` });
    }

    await connection.query('UPDATE exam SET is_published = 1 WHERE exam_id = ?', [exam.exam_id]);
    await connection.commit();
    res.json({ exam_id: exam.exam_id, is_published: 1, ...totals });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// PATCH unpublish — back to draft, only allowed while the exam has never been scheduled
exports.unpublishExam = asyncHandler(async (req, res) => {
  const exam = await loadOwnedExam(req, res);
  if (!exam) return;
  if (!exam.is_published) return res.status(409).json({ error: 'Exam is not published' });

  const [schedules] = await db.query('SELECT 1 FROM exam_schedule WHERE exam_id = ? LIMIT 1', [exam.exam_id]);
  if (schedules.length) {
    return res.status(409).json({ error: 'Exam has been scheduled and can no longer be unpublished' });
  }

  await db.query('UPDATE exam SET is_published = 0 WHERE exam_id = ?', [exam.exam_id]);
  res.json({ exam_id: exam.exam_id, is_published: 0 });
});

// DELETE draft exam (exam_question rows are removed automatically via ON DELETE CASCADE).
// Published exams are blocked because deleting them would cascade into schedules and student attempts.
exports.deleteExam = asyncHandler(async (req, res) => {
  const exam = await loadEditableExam(req, res);
  if (!exam) return;
  await db.query('DELETE FROM exam WHERE exam_id = ?', [exam.exam_id]);
  res.status(204).send();
});
