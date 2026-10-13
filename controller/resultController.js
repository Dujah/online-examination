const db = require('../db/db.js');
const asyncHandler = require('../middleware/asynchander');
const { finalizeExpiredAttempts } = require('./attemptController');

// Grading flow:
//   1. On submit, MCQs and blank THEORY answers are graded automatically (scorecard.graded_at set).
//   2. The teacher grades the remaining THEORY answers. The DB trigger trg_result_before_upd recalculates the grade
//      whenever result.total_marks_obtained changes.
//   3. Once every schedule has finished and every answer is graded, the teacher publishes. Students who never
//      started are recorded as ABSENT (0 marks), then sp_publish_results releases everything to students.
//   Published results are locked.

// A schedule counts as finished once its window has closed plus the attempt grace period,
// so no attempt can still be accepting answers.
const FINISHED_SQL = `NOW() > TIMESTAMP(es.exam_date, es.end_time) + INTERVAL 30 SECOND`;

const TOTALS_JOIN = `LEFT JOIN vw_exam_total_marks t ON t.exam_id = e.exam_id`;

async function loadOwnedExam(req, res, examId) {
  const [rows] = await db.query('SELECT * FROM exam WHERE exam_id = ?', [examId]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Exam not found' });
    return null;
  }
  if (req.user.role === 'TEACHER' && rows[0].created_by !== req.user.user_id) {
    res.status(403).json({ error: 'You can only manage results for exams you created' });
    return null;
  }
  return rows[0];
}

// Loads an attempt (with its result) for staff. Pass forUpdate inside a transaction to lock the student_exam row.
async function loadOwnedAttempt(req, res, conn = db, forUpdate = false) {
  const [rows] = await conn.query(`
    SELECT se.*, r.result_id, r.total_marks_obtained, r.grade, r.is_published,
           e.exam_id, e.exam_title, e.created_by, e.passing_marks,
           u.full_name, st.enrollment_no
    FROM student_exam se
    JOIN exam_schedule es ON es.schedule_id = se.schedule_id
    JOIN exam e ON e.exam_id = es.exam_id
    JOIN user u ON u.user_id = se.student_id
    JOIN student st ON st.student_id = se.student_id
    LEFT JOIN result r ON r.student_exam_id = se.student_exam_id
    WHERE se.student_exam_id = ?
    ${forUpdate ? 'FOR UPDATE OF se' : ''}
  `, [req.params.id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Attempt not found' });
    return null;
  }
  if (req.user.role === 'TEACHER' && rows[0].created_by !== req.user.user_id) {
    res.status(403).json({ error: 'You can only grade exams you created' });
    return null;
  }
  return rows[0];
}

// Question-by-question breakdown of one attempt. Staff see everything; students get the same shape once published.
async function loadBreakdown(resultId) {
  if (!resultId) return [];
  const [rows] = await db.query(`
    SELECT sc.question_order, q.question_id, q.question_text, q.question_type, q.marks AS max_marks,
           sc.selected_option_id, sel.option_text AS selected_option_text,
           sc.written_answer, sc.marks_obtained, sc.graded_at
    FROM scorecard sc
    JOIN question q ON q.question_id = sc.question_id
    LEFT JOIN option_choice sel ON sel.option_id = sc.selected_option_id
    WHERE sc.result_id = ?
    ORDER BY sc.question_order
  `, [resultId]);

  const mcqIds = rows.filter(r => r.question_type === 'MCQ').map(r => r.question_id);
  if (mcqIds.length) {
    const [options] = await db.query(
      'SELECT option_id, question_id, option_text, is_correct FROM option_choice WHERE question_id IN (?) ORDER BY display_order',
      [mcqIds]
    );
    rows.forEach(r => {
      if (r.question_type === 'MCQ') {
        r.options = options.filter(o => o.question_id === r.question_id)
          .map(o => ({ option_id: o.option_id, option_text: o.option_text, is_correct: !!o.is_correct }));
      }
    });
  }
  return rows;
}

// ---------- Staff ----------

// GET grading overview for an exam: every attempt with its score and how many answers still need grading
exports.getExamResults = asyncHandler(async (req, res) => {
  const exam = await loadOwnedExam(req, res, req.params.examId);
  if (!exam) return;

  const [attempts] = await db.query(`
    SELECT se.student_exam_id, se.student_id, u.full_name, st.enrollment_no,
           se.schedule_id, DATE_FORMAT(es.exam_date, '%Y-%m-%d') AS exam_date,
           se.status, se.started_at, se.submitted_at,
           r.total_marks_obtained, r.grade, COALESCE(r.is_published, 0) AS is_published,
           r.total_marks_obtained >= e.passing_marks AS passed,
           -- only submitted attempts are waiting on the teacher
           IF(se.status = 'COMPLETED',
              (SELECT COUNT(*) FROM scorecard sc WHERE sc.result_id = r.result_id AND sc.graded_at IS NULL), 0) AS ungraded_count
    FROM student_exam se
    JOIN exam_schedule es ON es.schedule_id = se.schedule_id
    JOIN exam e ON e.exam_id = es.exam_id
    JOIN user u ON u.user_id = se.student_id
    JOIN student st ON st.student_id = se.student_id
    LEFT JOIN result r ON r.student_exam_id = se.student_exam_id
    WHERE es.exam_id = ?
    ORDER BY u.full_name
  `, [exam.exam_id]);

  const [[totals]] = await db.query(
    'SELECT COALESCE(total_marks, 0) AS total_marks FROM exam e ' + TOTALS_JOIN + ' WHERE e.exam_id = ?',
    [exam.exam_id]
  );
  const [[sched]] = await db.query(`
    SELECT COUNT(*) AS active, COALESCE(SUM(${FINISHED_SQL}), 0) AS finished
    FROM exam_schedule es WHERE es.exam_id = ? AND es.is_cancelled = 0
  `, [exam.exam_id]);

  res.json({
    exam_id: exam.exam_id,
    exam_title: exam.exam_title,
    total_marks: Number(totals.total_marks),
    passing_marks: exam.passing_marks,
    all_schedules_finished: sched.active > 0 && Number(sched.finished) === sched.active,
    pending_grading: attempts.reduce((n, a) => n + Number(a.ungraded_count || 0), 0),
    results_published: attempts.length > 0 && attempts.every(a => a.is_published),
    attempts
  });
});

// GET one attempt for grading: every question with the student's answer, correct option, and marks
exports.getAttemptForGrading = asyncHandler(async (req, res) => {
  const attempt = await loadOwnedAttempt(req, res);
  if (!attempt) return;

  const { created_by, ...info } = attempt;
  res.json({ ...info, questions: await loadBreakdown(attempt.result_id) });
});

// PUT grade THEORY answers. Body: { marks: [{ question_id, marks_obtained }] }. Can be re-graded until published.
exports.gradeAttempt = asyncHandler(async (req, res) => {
  const { marks } = req.body;
  if (!Array.isArray(marks) || marks.length === 0) {
    return res.status(400).json({ error: 'marks must be a non-empty array' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const attempt = await loadOwnedAttempt(req, res, connection, true);
    if (!attempt) {
      await connection.rollback();
      return;
    }
    if (attempt.status !== 'COMPLETED') {
      await connection.rollback();
      return res.status(409).json({ error: `Only submitted attempts can be graded (this one is ${attempt.status.toLowerCase()})` });
    }
    if (attempt.is_published) {
      await connection.rollback();
      return res.status(409).json({ error: 'Results are published and can no longer be changed' });
    }

    const [rows] = await connection.query(`
      SELECT sc.question_id, q.question_type, q.marks AS max_marks
      FROM scorecard sc JOIN question q ON q.question_id = sc.question_id
      WHERE sc.result_id = ?
    `, [attempt.result_id]);
    const byId = new Map(rows.map(r => [r.question_id, r]));

    // Validate everything before writing anything
    const seen = new Set();
    for (const m of marks) {
      const qid = Number(m && m.question_id);
      const q = byId.get(qid);
      if (!q) {
        await connection.rollback();
        return res.status(400).json({ error: `Question ${m && m.question_id} is not part of this attempt` });
      }
      if (seen.has(qid)) {
        await connection.rollback();
        return res.status(400).json({ error: `Question ${qid} appears more than once` });
      }
      seen.add(qid);
      if (q.question_type !== 'THEORY') {
        await connection.rollback();
        return res.status(400).json({ error: `Question ${qid} is an MCQ and is graded automatically` });
      }
      const value = Number(m.marks_obtained);
      if (m.marks_obtained === null || m.marks_obtained === '' || !Number.isFinite(value) || value < 0 || value > Number(q.max_marks)) {
        await connection.rollback();
        return res.status(400).json({ error: `marks_obtained for question ${qid} must be between 0 and ${q.max_marks}` });
      }
    }

    for (const m of marks) {
      await connection.query(
        'UPDATE scorecard SET marks_obtained = ?, graded_at = NOW() WHERE result_id = ? AND question_id = ?',
        [Number(m.marks_obtained), attempt.result_id, Number(m.question_id)]
      );
    }
    // trg_result_before_upd recalculates the grade when the total changes
    await connection.query(`
      UPDATE result r
      SET r.total_marks_obtained = (SELECT COALESCE(SUM(marks_obtained), 0) FROM scorecard WHERE result_id = r.result_id)
      WHERE r.result_id = ?
    `, [attempt.result_id]);

    const [[updated]] = await connection.query(`
      SELECT r.total_marks_obtained, r.grade,
             (SELECT COUNT(*) FROM scorecard WHERE result_id = r.result_id AND graded_at IS NULL) AS ungraded_count
      FROM result r WHERE r.result_id = ?
    `, [attempt.result_id]);

    await connection.commit();
    res.json({ student_exam_id: attempt.student_exam_id, ...updated });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// POST publish results for an exam — requires every schedule finished and every answer graded.
// Students in the exam's semester who never started are recorded as ABSENT with 0 marks first.
exports.publishExamResults = asyncHandler(async (req, res) => {
  const exam = await loadOwnedExam(req, res, req.params.examId);
  if (!exam) return;

  // Close any attempts whose time ran out but which the background sweep hasn't reached yet
  await finalizeExpiredAttempts();

  const [[sched]] = await db.query(`
    SELECT COUNT(*) AS active, COALESCE(SUM(${FINISHED_SQL}), 0) AS finished
    FROM exam_schedule es WHERE es.exam_id = ? AND es.is_cancelled = 0
  `, [exam.exam_id]);
  if (sched.active === 0) {
    return res.status(409).json({ error: 'This exam has not been held yet' });
  }
  if (Number(sched.finished) !== sched.active) {
    return res.status(409).json({ error: 'Results can be published once every schedule for this exam has finished' });
  }

  const [[pending]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM student_exam se JOIN exam_schedule es ON es.schedule_id = se.schedule_id
        WHERE es.exam_id = ? AND se.status = 'IN_PROGRESS') AS in_progress,
      (SELECT COUNT(*) FROM scorecard sc
        JOIN result r ON r.result_id = sc.result_id
        JOIN student_exam se ON se.student_exam_id = r.student_exam_id
        JOIN exam_schedule es ON es.schedule_id = se.schedule_id
        WHERE es.exam_id = ? AND sc.graded_at IS NULL) AS ungraded
  `, [exam.exam_id, exam.exam_id]);
  if (pending.in_progress > 0) {
    return res.status(409).json({ error: `${pending.in_progress} attempt(s) are still being finalized. Try again in a minute` });
  }
  if (pending.ungraded > 0) {
    return res.status(409).json({ error: `${pending.ungraded} answer(s) still need grading` });
  }

  const connection = await db.getConnection();
  let absentCount = 0;
  try {
    await connection.beginTransaction();

    // Absent students are recorded against the exam's last held schedule
    const [[lastSchedule]] = await connection.query(`
      SELECT schedule_id FROM exam_schedule
      WHERE exam_id = ? AND is_cancelled = 0
      ORDER BY exam_date DESC, end_time DESC LIMIT 1
    `, [exam.exam_id]);

    // Pre-registered students who never started become ABSENT
    const [registered] = await connection.query(`
      SELECT se.student_exam_id FROM student_exam se JOIN exam_schedule es ON es.schedule_id = se.schedule_id
      WHERE es.exam_id = ? AND se.status = 'REGISTERED' FOR UPDATE OF se
    `, [exam.exam_id]);
    const absentIds = registered.map(r => r.student_exam_id);
    if (absentIds.length) {
      await connection.query(`UPDATE student_exam SET status = 'ABSENT' WHERE student_exam_id IN (?)`, [absentIds]);
    }

    // Students in the semester with no record at all for this exam become ABSENT
    const [missing] = await connection.query(`
      SELECT st.student_id FROM student st
      WHERE st.semester_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM student_exam se JOIN exam_schedule es ON es.schedule_id = se.schedule_id
          WHERE es.exam_id = ? AND se.student_id = st.student_id
        )
    `, [exam.semester_id, exam.exam_id]);
    for (const { student_id } of missing) {
      const [ins] = await connection.query(
        `INSERT INTO student_exam (student_id, schedule_id, attempt_number, status) VALUES (?, ?, 1, 'ABSENT')`,
        [student_id, lastSchedule.schedule_id]
      );
      absentIds.push(ins.insertId);
    }

    // Give every absentee a 0-mark result so they're published alongside everyone else (grade set by trigger)
    if (absentIds.length) {
      await connection.query(
        'INSERT IGNORE INTO result (student_exam_id, total_marks_obtained) VALUES ?',
        [absentIds.map(id => [id, 0])]
      );
    }
    absentCount = absentIds.length;

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const [[{ unpublished }]] = await db.query(`
    SELECT COUNT(*) AS unpublished FROM result r
    JOIN student_exam se ON se.student_exam_id = r.student_exam_id
    JOIN exam_schedule es ON es.schedule_id = se.schedule_id
    WHERE es.exam_id = ? AND r.is_published = 0
  `, [exam.exam_id]);
  if (unpublished === 0) {
    return res.status(409).json({ error: 'Results for this exam are already published' });
  }

  // sp_publish_results runs its own transaction, so it's called on its own
  await db.query('CALL sp_publish_results(?)', [exam.exam_id]);
  res.json({ exam_id: exam.exam_id, published: unpublished, marked_absent: absentCount });
});

// ---------- Student ----------

// GET the student's published results
exports.getMyResults = asyncHandler(async (req, res) => {
  const [rows] = await db.query(`
    SELECT se.student_exam_id, e.exam_id, e.exam_title, s.subject_name,
           DATE_FORMAT(es.exam_date, '%Y-%m-%d') AS exam_date, se.status,
           r.total_marks_obtained, COALESCE(t.total_marks, 0) AS total_marks,
           ROUND(r.total_marks_obtained / NULLIF(t.total_marks, 0) * 100, 2) AS percentage,
           r.grade, e.passing_marks, r.total_marks_obtained >= e.passing_marks AS passed, r.published_at
    FROM result r
    JOIN student_exam se ON se.student_exam_id = r.student_exam_id
    JOIN exam_schedule es ON es.schedule_id = se.schedule_id
    JOIN exam e ON e.exam_id = es.exam_id
    JOIN subject s ON s.subject_id = e.subject_id
    ${TOTALS_JOIN}
    WHERE se.student_id = ? AND r.is_published = 1
    ORDER BY r.published_at DESC
  `, [req.user.user_id]);
  res.json(rows);
});

// GET one published result with the question-by-question breakdown
exports.getMyResultById = asyncHandler(async (req, res) => {
  const [rows] = await db.query(`
    SELECT se.student_exam_id, se.status, se.started_at, se.submitted_at,
           e.exam_id, e.exam_title, e.passing_marks, COALESCE(t.total_marks, 0) AS total_marks,
           r.result_id, r.total_marks_obtained, r.grade, r.published_at,
           r.total_marks_obtained >= e.passing_marks AS passed
    FROM result r
    JOIN student_exam se ON se.student_exam_id = r.student_exam_id
    JOIN exam_schedule es ON es.schedule_id = se.schedule_id
    JOIN exam e ON e.exam_id = es.exam_id
    ${TOTALS_JOIN}
    WHERE se.student_exam_id = ? AND se.student_id = ? AND r.is_published = 1
  `, [req.params.id, req.user.user_id]);
  // Unpublished and other students' results look the same: not found
  if (rows.length === 0) return res.status(404).json({ error: 'Result not found' });

  const { result_id, ...result } = rows[0];
  const questions = (await loadBreakdown(result_id)).map(({ graded_at, ...q }) => q);
  res.json({ ...result, questions });
});
