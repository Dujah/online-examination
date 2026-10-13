const crypto = require('crypto');
const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander');

// How an attempt is stored:
//   student_exam  — the attempt itself (status, started_at, submitted_at). One attempt per student per schedule.
//   result        — created at start, holds the running total (unpublished until grading is done)
//   scorecard     — one row per question, created at start with this student's question_order; answers are saved here
//
// Deadline = the earlier of (started_at + exam duration) and the end of the schedule window.
// Answers are accepted for a short grace period after it to absorb network lag; then the attempt is finalized.

const GRACE_SECONDS = 30;
const MAX_ANSWER_LENGTH = 10000;

const DEADLINE_SQL = `LEAST(se.started_at + INTERVAL e.duration_minutes MINUTE, TIMESTAMP(es.exam_date, es.end_time))`;

// Loads one attempt with its deadline info. Pass forUpdate inside a transaction to lock just the student_exam row
// (FOR UPDATE OF se — locking the shared exam row would serialise every student sitting the exam).
async function loadAttempt(conn, studentExamId, forUpdate = false) {
  const [rows] = await conn.query(`
    SELECT se.*, es.exam_id, e.exam_title, e.duration_minutes, r.result_id,
           ${DEADLINE_SQL} AS deadline,
           GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), ${DEADLINE_SQL})) AS seconds_remaining,
           NOW() > ${DEADLINE_SQL} + INTERVAL ${GRACE_SECONDS} SECOND AS is_expired
    FROM student_exam se
    JOIN exam_schedule es ON es.schedule_id = se.schedule_id
    JOIN exam e ON e.exam_id = es.exam_id
    LEFT JOIN result r ON r.student_exam_id = se.student_exam_id
    WHERE se.student_exam_id = ?
    ${forUpdate ? 'FOR UPDATE OF se' : ''}
  `, [studentExamId]);
  return rows[0] || null;
}

// Loads the caller's own attempt or sends 404 (also for other students' attempts — don't reveal they exist)
async function loadOwnAttempt(req, res, conn = db, forUpdate = false) {
  const attempt = await loadAttempt(conn, req.params.id, forUpdate);
  if (!attempt || attempt.student_id !== req.user.user_id) {
    res.status(404).json({ error: 'Attempt not found' });
    return null;
  }
  return attempt;
}

// Marks the attempt COMPLETED and auto-grades what needs no teacher: MCQs, and THEORY answers left blank (0 marks).
// THEORY answers with text stay ungraded (graded_at NULL) until a teacher grades them.
// Must run inside a transaction that holds the student_exam row lock.
async function finalizeAttempt(conn, attempt) {
  await conn.query(`
    UPDATE scorecard sc
    JOIN question q ON q.question_id = sc.question_id
    LEFT JOIN option_choice oc ON oc.option_id = sc.selected_option_id
    SET sc.marks_obtained = IF(q.question_type = 'MCQ' AND oc.is_correct = 1, q.marks, 0),
        sc.graded_at = IF(q.question_type = 'MCQ' OR TRIM(COALESCE(sc.written_answer, '')) = '', NOW(), NULL)
    WHERE sc.result_id = ?
  `, [attempt.result_id]);

  await conn.query(`
    UPDATE result r
    SET r.total_marks_obtained = (SELECT COALESCE(SUM(marks_obtained), 0) FROM scorecard WHERE result_id = r.result_id)
    WHERE r.result_id = ?
  `, [attempt.result_id]);

  // trg_se_timestamps stamps submitted_at = NOW() on the IN_PROGRESS -> COMPLETED change...
  await conn.query(`UPDATE student_exam SET status = 'COMPLETED' WHERE student_exam_id = ?`, [attempt.student_exam_id]);
  // ...so pull it back to the deadline for attempts that expired, rather than whenever the sweep happened to run.
  // (The trigger doesn't fire on this second update because the status is already COMPLETED.)
  await conn.query(`
    UPDATE student_exam se
    JOIN exam_schedule es ON es.schedule_id = se.schedule_id
    JOIN exam e ON e.exam_id = es.exam_id
    SET se.submitted_at = LEAST(se.submitted_at, ${DEADLINE_SQL})
    WHERE se.student_exam_id = ?
  `, [attempt.student_exam_id]);
}

// Finalizes the attempt if its time is up. Returns true if it is (now) closed.
async function closeIfExpired(conn, attempt) {
  if (attempt.status === 'IN_PROGRESS' && attempt.is_expired) {
    await finalizeAttempt(conn, attempt);
    attempt.status = 'COMPLETED';
  }
  return attempt.status !== 'IN_PROGRESS';
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Builds the student's view of an attempt: questions in their order, options WITHOUT is_correct, saved answers
async function buildAttemptView(attempt) {
  const [questions] = await db.query(`
    SELECT sc.question_order, q.question_id, q.question_text, q.question_type, q.marks,
           sc.selected_option_id, sc.written_answer
    FROM scorecard sc
    JOIN question q ON q.question_id = sc.question_id
    WHERE sc.result_id = ?
    ORDER BY sc.question_order
  `, [attempt.result_id]);

  const mcqIds = questions.filter(q => q.question_type === 'MCQ').map(q => q.question_id);
  if (mcqIds.length) {
    const [options] = await db.query(
      'SELECT option_id, question_id, option_text FROM option_choice WHERE question_id IN (?) ORDER BY display_order',
      [mcqIds]
    );
    questions.forEach(q => {
      if (q.question_type === 'MCQ') {
        q.options = options.filter(o => o.question_id === q.question_id).map(({ option_id, option_text }) => ({ option_id, option_text }));
      }
    });
  }

  return {
    student_exam_id: attempt.student_exam_id,
    schedule_id: attempt.schedule_id,
    exam_id: attempt.exam_id,
    exam_title: attempt.exam_title,
    duration_minutes: attempt.duration_minutes,
    status: attempt.status,
    started_at: attempt.started_at,
    submitted_at: attempt.submitted_at,
    deadline: attempt.deadline,
    // Use this for the client timer rather than comparing clocks
    seconds_remaining: attempt.status === 'IN_PROGRESS' ? attempt.seconds_remaining : 0,
    questions
  };
}

// GET the student's own attempts
exports.getMyAttempts = asyncHandler(async (req, res) => {
  const [rows] = await db.query(`
    SELECT se.student_exam_id, se.schedule_id, se.status, se.started_at, se.submitted_at,
           e.exam_id, e.exam_title, s.subject_name, DATE_FORMAT(es.exam_date, '%Y-%m-%d') AS exam_date
    FROM student_exam se
    JOIN exam_schedule es ON es.schedule_id = se.schedule_id
    JOIN exam e ON e.exam_id = es.exam_id
    JOIN subject s ON s.subject_id = e.subject_id
    WHERE se.student_id = ?
    ORDER BY es.exam_date DESC, es.start_time DESC
  `, [req.user.user_id]);
  res.json(rows);
});

// POST start an attempt (or resume the one in progress). Body: { schedule_id }
exports.startAttempt = asyncHandler(async (req, res) => {
  const { schedule_id } = req.body;
  const studentId = req.user.user_id;
  if (!schedule_id) return res.status(400).json({ error: 'schedule_id is required' });

  const connection = await db.getConnection();
  let attemptId;
  try {
    await connection.beginTransaction();

    // Lock the student row so a double-click can't create two attempts
    const [students] = await connection.query('SELECT semester_id FROM student WHERE student_id = ? FOR UPDATE', [studentId]);
    if (students.length === 0) {
      await connection.rollback();
      return res.status(403).json({ error: 'No student profile found for this account' });
    }

    const [schedules] = await connection.query(`
      SELECT es.*, e.semester_id, e.is_published, e.randomize_questions,
             NOW() >= TIMESTAMP(es.exam_date, es.start_time) AS has_started,
             NOW() < TIMESTAMP(es.exam_date, es.end_time) AS not_ended
      FROM exam_schedule es JOIN exam e ON e.exam_id = es.exam_id
      WHERE es.schedule_id = ?
    `, [schedule_id]);
    const schedule = schedules[0];
    // Rule: students can only see exams for their own semester — treat anything else as not found
    if (!schedule || !schedule.is_published || schedule.semester_id !== students[0].semester_id) {
      await connection.rollback();
      return res.status(404).json({ error: 'Exam schedule not found' });
    }
    if (schedule.is_cancelled) {
      await connection.rollback();
      return res.status(409).json({ error: 'This exam has been cancelled' });
    }

    const [existing] = await connection.query(
      'SELECT student_exam_id, status FROM student_exam WHERE student_id = ? AND schedule_id = ? ORDER BY attempt_number DESC LIMIT 1',
      [studentId, schedule_id]
    );
    const prior = existing[0];

    if (prior && prior.status === 'IN_PROGRESS') {
      // Resume — but close it first if time has run out
      const attempt = await loadAttempt(connection, prior.student_exam_id, true);
      if (await closeIfExpired(connection, attempt)) {
        await connection.commit();
        return res.status(409).json({ error: 'Time is up for this exam. Your answers have been submitted' });
      }
      attemptId = prior.student_exam_id;
    } else if (prior && prior.status !== 'REGISTERED') {
      await connection.rollback();
      return res.status(409).json({ error: 'You have already taken this exam' });
    } else {
      if (!schedule.has_started) {
        await connection.rollback();
        return res.status(409).json({ error: 'This exam has not started yet' });
      }
      if (!schedule.not_ended) {
        await connection.rollback();
        return res.status(409).json({ error: 'This exam has already ended' });
      }

      if (prior) {
        // A REGISTERED row (pre-registration) becomes the attempt
        attemptId = prior.student_exam_id;
        await connection.query(
          `UPDATE student_exam SET status = 'IN_PROGRESS', started_at = NOW() WHERE student_exam_id = ?`,
          [attemptId]
        );
      } else {
        const [ins] = await connection.query(
          `INSERT INTO student_exam (student_id, schedule_id, attempt_number, status, started_at) VALUES (?, ?, 1, 'IN_PROGRESS', NOW())`,
          [studentId, schedule_id]
        );
        attemptId = ins.insertId;
      }

      const [rIns] = await connection.query('INSERT INTO result (student_exam_id) VALUES (?)', [attemptId]);

      // Fix this student's question order now, so it stays the same on reload
      const [eqRows] = await connection.query(
        'SELECT question_id FROM exam_question WHERE exam_id = ? ORDER BY sequence_no',
        [schedule.exam_id]
      );
      const questionIds = eqRows.map(r => r.question_id);
      if (schedule.randomize_questions) shuffle(questionIds);
      await connection.query(
        'INSERT INTO scorecard (result_id, question_id, question_order) VALUES ?',
        [questionIds.map((qid, i) => [rIns.insertId, qid, i + 1])]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const attempt = await loadAttempt(db, attemptId);
  res.status(201).json(await buildAttemptView(attempt));
});

// GET one of the student's attempts (questions, saved answers, time remaining)
exports.getAttempt = asyncHandler(async (req, res) => {
  const connection = await db.getConnection();
  let attempt;
  try {
    await connection.beginTransaction();
    attempt = await loadOwnAttempt(req, res, connection, true);
    if (!attempt) {
      await connection.rollback();
      return;
    }
    await closeIfExpired(connection, attempt);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
  res.json(await buildAttemptView(attempt));
});

// PUT save answers (autosave). Body: { answers: [{ question_id, selected_option_id }, { question_id, written_answer }] }
// Send null to clear an answer. Can be called as often as needed until the deadline.
exports.saveAnswers = asyncHandler(async (req, res) => {
  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers must be a non-empty array' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const attempt = await loadOwnAttempt(req, res, connection, true);
    if (!attempt) {
      await connection.rollback();
      return;
    }
    if (attempt.status !== 'IN_PROGRESS') {
      await connection.rollback();
      return res.status(409).json({ error: 'This attempt has already been submitted' });
    }
    if (await closeIfExpired(connection, attempt)) {
      await connection.commit();
      return res.status(409).json({ error: 'Time is up. Your saved answers have been submitted' });
    }

    const [rows] = await connection.query(
      'SELECT sc.question_id, q.question_type FROM scorecard sc JOIN question q ON q.question_id = sc.question_id WHERE sc.result_id = ?',
      [attempt.result_id]
    );
    const typeById = new Map(rows.map(r => [r.question_id, r.question_type]));
    const [opts] = await connection.query(
      'SELECT option_id, question_id FROM option_choice WHERE question_id IN (?)',
      [[...typeById.keys()]]
    );
    const optionQuestion = new Map(opts.map(o => [o.option_id, o.question_id]));

    // Validate everything before writing anything
    const updates = [];
    const seen = new Set();
    for (const a of answers) {
      const qid = Number(a && a.question_id);
      const type = typeById.get(qid);
      if (!type) {
        await connection.rollback();
        return res.status(400).json({ error: `Question ${a && a.question_id} is not part of this exam` });
      }
      if (seen.has(qid)) {
        await connection.rollback();
        return res.status(400).json({ error: `Question ${qid} appears more than once` });
      }
      seen.add(qid);

      if (type === 'MCQ') {
        const optionId = a.selected_option_id == null ? null : Number(a.selected_option_id);
        if (optionId !== null && optionQuestion.get(optionId) !== qid) {
          await connection.rollback();
          return res.status(400).json({ error: `Option ${a.selected_option_id} does not belong to question ${qid}` });
        }
        updates.push([optionId, null, qid]);
      } else {
        const text = a.written_answer == null ? null : a.written_answer;
        if (text !== null && typeof text !== 'string') {
          await connection.rollback();
          return res.status(400).json({ error: `written_answer for question ${qid} must be text` });
        }
        if (text !== null && text.length > MAX_ANSWER_LENGTH) {
          await connection.rollback();
          return res.status(400).json({ error: `Answer for question ${qid} is longer than ${MAX_ANSWER_LENGTH} characters` });
        }
        updates.push([null, text, qid]);
      }
    }

    for (const [optionId, text, qid] of updates) {
      await connection.query(
        'UPDATE scorecard SET selected_option_id = ?, written_answer = ? WHERE result_id = ? AND question_id = ?',
        [optionId, text, attempt.result_id, qid]
      );
    }

    await connection.commit();
    res.json({ saved: updates.length, seconds_remaining: attempt.seconds_remaining });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// POST submit — finalizes the attempt (also allowed after the deadline: it just locks in what was saved)
exports.submitAttempt = asyncHandler(async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const attempt = await loadOwnAttempt(req, res, connection, true);
    if (!attempt) {
      await connection.rollback();
      return;
    }
    if (attempt.status !== 'IN_PROGRESS') {
      await connection.rollback();
      return res.status(409).json({ error: 'This attempt has already been submitted' });
    }

    await finalizeAttempt(connection, attempt);
    await connection.commit();
    // Scores are not returned — they're released when the teacher publishes results
    res.json({ student_exam_id: attempt.student_exam_id, status: 'COMPLETED' });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// Finalizes attempts whose time ran out without the student submitting (closed tab, lost connection).
// Run periodically from index.js.
exports.finalizeExpiredAttempts = async () => {
  const [expired] = await db.query(`
    SELECT se.student_exam_id
    FROM student_exam se
    JOIN exam_schedule es ON es.schedule_id = se.schedule_id
    JOIN exam e ON e.exam_id = es.exam_id
    WHERE se.status = 'IN_PROGRESS' AND NOW() > ${DEADLINE_SQL} + INTERVAL ${GRACE_SECONDS} SECOND
  `);

  for (const { student_exam_id } of expired) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const attempt = await loadAttempt(connection, student_exam_id, true);
      await closeIfExpired(connection, attempt); // re-checks under the lock in case the student just submitted
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      console.error(`Failed to finalize attempt ${student_exam_id}:`, err.message);
    } finally {
      connection.release();
    }
  }
  return expired.length;
};
