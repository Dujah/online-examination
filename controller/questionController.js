const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander');

// GET all questions (optionally filter by subject: /api/questions?subject_id=1)
exports.getAllQuestions = asyncHandler(async (req, res) => {
  const { subject_id } = req.query;
  const sql = subject_id
    ? 'SELECT * FROM question WHERE subject_id = ?'
    : 'SELECT * FROM question';
  const params = subject_id ? [subject_id] : [];
  const [rows] = await db.query(sql, params);
  res.json(rows);
});

// GET one question WITH its options (if MCQ)
exports.getQuestionById = asyncHandler(async (req, res) => {
  const [qRows] = await db.query('SELECT * FROM question WHERE question_id = ?', [req.params.id]);
  if (qRows.length === 0) return res.status(404).json({ error: 'Question not found' });

  const question = qRows[0];

  if (question.question_type === 'MCQ') {
    const [options] = await db.query(
      'SELECT option_id, option_text, is_correct, display_order FROM option_choice WHERE question_id = ? ORDER BY display_order',
      [req.params.id]
    );
    question.options = options;
  }

  res.json(question);
});

// POST create a question (THEORY = simple insert, MCQ = transaction with options)
exports.createQuestion = asyncHandler(async (req, res) => {
  const { subject_id, question_text, question_type, marks, options } = req.body;
  const created_by = req.user.user_id; // NEVER trust this from the client — take it from the verified token
  const userRole = req.user.role;

  if (!subject_id || !question_text || !question_type) {
    return res.status(400).json({ error: 'subject_id, question_text, and question_type are required' });
  }
  if (!['MCQ', 'THEORY'].includes(question_type)) {
    return res.status(400).json({ error: 'question_type must be MCQ or THEORY' });
  }

  // Rule: a TEACHER can only add questions to a subject they're assigned to. ADMIN bypasses this check.
  if (userRole === 'TEACHER') {
    const [assignment] = await db.query(
      'SELECT * FROM teaching_assignment WHERE teacher_id = ? AND subject_id = ?',
      [created_by, subject_id]
    );
    if (assignment.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject' });
    }
  }

  if (question_type === 'MCQ') {
    const invalid = validateOptions(options);
    if (invalid) return res.status(400).json({ error: invalid });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [qResult] = await connection.query(
      'INSERT INTO question (subject_id, created_by, question_text, question_type, marks) VALUES (?, ?, ?, ?, ?)',
      [subject_id, created_by, question_text, question_type, marks || 1.00]
    );
    const newQuestionId = qResult.insertId;

    if (question_type === 'MCQ') {
      for (let i = 0; i < options.length; i++) {
        await connection.query(
          'INSERT INTO option_choice (question_id, option_text, is_correct, display_order) VALUES (?, ?, ?, ?)',
          [newQuestionId, options[i].option_text, !!options[i].is_correct, i + 1]
        );
      }
    }

    await connection.commit();
    res.status(201).json({ question_id: newQuestionId, subject_id, question_text, question_type, marks: marks || 1.00 });

  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'subject_id does not exist' });
    }
    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({ error: 'marks must be greater than 0' });
    }
    throw err;
  } finally {
    connection.release();
  }
});

// Rule: MCQ questions need at least 2 options with non-empty text, exactly one marked correct.
// Returns an error message or null.
function validateOptions(options) {
  if (!Array.isArray(options) || options.length < 2) return 'MCQ questions require at least 2 options';
  if (options.some(o => !o || typeof o.option_text !== 'string' || !o.option_text.trim())) {
    return 'Every option needs text';
  }
  if (options.some(o => o.option_text.length > 255)) return 'Option text must be 255 characters or fewer';
  if (options.filter(o => o.is_correct === true).length !== 1) return 'Exactly one option must be marked as correct';
  return null;
}

// Rule: a question that's part of a published exam is locked — editing or deleting it would silently change that exam
async function isInPublishedExam(questionId) {
  const [rows] = await db.query(
    'SELECT 1 FROM exam_question eq JOIN exam e ON e.exam_id = eq.exam_id WHERE eq.question_id = ? AND e.is_published = 1 LIMIT 1',
    [questionId]
  );
  return rows.length > 0;
}

// Loads a question the caller may change: it must exist, belong to them (ADMIN bypasses), and not be locked
// by a published exam. Sends the error response and returns null on failure.
async function loadEditableQuestion(req, res, action) {
  const [rows] = await db.query('SELECT * FROM question WHERE question_id = ?', [req.params.id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Question not found' });
    return null;
  }
  // Rule: a TEACHER can only change questions they created
  if (req.user.role === 'TEACHER' && rows[0].created_by !== req.user.user_id) {
    res.status(403).json({ error: `You can only ${action} questions you created` });
    return null;
  }
  if (await isInPublishedExam(req.params.id)) {
    res.status(409).json({ error: `Question is used in a published exam and cannot be ${action === 'edit' ? 'changed' : 'deleted'}` });
    return null;
  }
  return rows[0];
}

// PUT update a question. Partial updates allowed: { question_text?, marks?, options? }.
// For MCQs, sending options replaces the whole option list. question_type and subject can't change.
exports.updateQuestion = asyncHandler(async (req, res) => {
  const question = await loadEditableQuestion(req, res, 'edit');
  if (!question) return;

  const { question_text, marks, options } = req.body;
  if (req.body.question_type !== undefined && req.body.question_type !== question.question_type) {
    return res.status(400).json({ error: 'question_type cannot be changed. Create a new question instead' });
  }
  if (req.body.subject_id !== undefined && Number(req.body.subject_id) !== question.subject_id) {
    return res.status(400).json({ error: 'subject_id cannot be changed. Create a new question instead' });
  }
  if (question_text !== undefined && !String(question_text).trim()) {
    return res.status(400).json({ error: 'question_text cannot be empty' });
  }
  if (marks !== undefined && !(Number(marks) > 0)) {
    return res.status(400).json({ error: 'marks must be greater than 0' });
  }
  if (options !== undefined) {
    if (question.question_type !== 'MCQ') {
      return res.status(400).json({ error: 'Only MCQ questions have options' });
    }
    const invalid = validateOptions(options);
    if (invalid) return res.status(400).json({ error: invalid });
  }

  const updated = {
    question_text: question_text !== undefined ? question_text : question.question_text,
    marks: marks !== undefined ? marks : question.marks
  };

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      'UPDATE question SET question_text = ?, marks = ? WHERE question_id = ?',
      [updated.question_text, updated.marks, question.question_id]
    );

    // Replace the options wholesale. Safe because a question with answers on record is always in a published
    // exam, and those are locked above.
    if (options !== undefined) {
      await connection.query('DELETE FROM option_choice WHERE question_id = ?', [question.question_id]);
      for (let i = 0; i < options.length; i++) {
        await connection.query(
          'INSERT INTO option_choice (question_id, option_text, is_correct, display_order) VALUES (?, ?, ?, ?)',
          [question.question_id, options[i].option_text, !!options[i].is_correct, i + 1]
        );
      }
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const response = { question_id: question.question_id, question_type: question.question_type, ...updated };
  if (question.question_type === 'MCQ') {
    const [opts] = await db.query(
      'SELECT option_id, option_text, is_correct, display_order FROM option_choice WHERE question_id = ? ORDER BY display_order',
      [question.question_id]
    );
    response.options = opts;
  }
  res.json(response);
});

// DELETE question (option_choice rows are removed automatically via ON DELETE CASCADE)
exports.deleteQuestion = asyncHandler(async (req, res) => {
  const question = await loadEditableQuestion(req, res, 'delete');
  if (!question) return;
  await db.query('DELETE FROM question WHERE question_id = ?', [question.question_id]);
  res.status(204).send();
});