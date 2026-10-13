import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../api';
import { useApiData } from '../../hooks/useApiData';
import { useAction } from '../../hooks/useAction';
import { Badge, ErrorText, Message } from '../../components/ui';
import { num } from '../../format';

// One student's paper. MCQs are auto-marked; the teacher enters marks for written answers.
export default function GradeAttempt() {
  const { id } = useParams();
  const { data: attempt, loading, error, reload } = useApiData(`/results/attempts/${id}`, null);
  // Lives here, not in the form: the form remounts after each save and would lose it
  const [notice, setNotice] = useState(null);

  if (loading && !attempt) return <p className="muted">Loading…</p>;
  if (!attempt) return <ErrorText error={error || 'Attempt not found'} />;
  // Remount the form after each save so it starts from the saved marks
  return (
    <GradingForm key={attempt.total_marks_obtained + attempt.questions.map(q => q.graded_at).join()}
      attempt={attempt} notice={notice} onSaved={() => { setNotice({ type: 'success', text: 'Marks saved.' }); reload(); }} />
  );
}

function GradingForm({ attempt, notice, onSaved }) {
  const locked = Boolean(attempt.is_published);
  // Theory answers with text that the teacher can grade. Blank answers were auto-graded 0 on submit.
  const gradable = attempt.questions.filter(q => q.question_type === 'THEORY' && q.written_answer?.trim());
  const [marks, setMarks] = useState(() =>
    Object.fromEntries(gradable.map(q => [q.question_id, q.graded_at ? num(q.marks_obtained) : ''])));
  const { busy, message, run } = useAction();

  const changed = gradable.filter(q => marks[q.question_id] !== '' && marks[q.question_id] !== (q.graded_at ? num(q.marks_obtained) : ''));
  const ungraded = gradable.filter(q => !q.graded_at).length;

  const save = async (e) => {
    e.preventDefault();
    const body = { marks: changed.map(q => ({ question_id: q.question_id, marks_obtained: Number(marks[q.question_id]) })) };
    if (await run(() => api.put(`/results/attempts/${attempt.student_exam_id}/marks`, body))) onSaved();
  };

  return (
    <form className="stack" onSubmit={save}>
      <p className="breadcrumb"><Link to={`/teacher/exams/${attempt.exam_id}/results`}>← Results for {attempt.exam_title}</Link></p>
      <div className="page-header">
        <div>
          <h1>{attempt.full_name}</h1>
          <p className="muted">{attempt.enrollment_no} · {attempt.exam_title}</p>
        </div>
        <div className="score-box">
          <span className="stat-value">{num(attempt.total_marks_obtained)}</span>
          <span className="muted small">grade {attempt.grade ?? '—'}{ungraded > 0 ? ` · ${ungraded} to grade` : ''}</span>
        </div>
      </div>

      {locked && <p className="msg msg-success">Results are published, so these marks are final.</p>}
      <Message message={message || notice} />

      {attempt.questions.map((q, i) => (
        <div key={q.question_id} className={`card answer-card ${q.question_type === 'THEORY' && !q.graded_at ? 'needs-grading' : ''}`}>
          <div className="paper-q">
            <span><strong>Q{i + 1}.</strong> {q.question_text}</span>
            <span className="muted small"><Badge value={q.question_type} label={q.question_type === 'MCQ' ? 'MCQ' : 'theory'} /> out of {num(q.max_marks)}</span>
          </div>

          {q.question_type === 'MCQ' ? (
            <>
              <ul className="option-list">
                {q.options.map(o => (
                  <li key={o.option_id} className={[o.is_correct && 'correct', o.option_id === q.selected_option_id && !o.is_correct && 'wrong'].filter(Boolean).join(' ')}>
                    {o.option_text}
                    {o.option_id === q.selected_option_id && <span className="small"> ← student's answer</span>}
                    {o.is_correct && ' ✓'}
                  </li>
                ))}
              </ul>
              <p className="muted small">{q.selected_option_id ? '' : 'Not answered. '}Auto-marked: {num(q.marks_obtained)} / {num(q.max_marks)}</p>
            </>
          ) : q.written_answer?.trim() ? (
            <>
              <blockquote className="written-answer">{q.written_answer}</blockquote>
              <label className="marks-input">
                Marks (0 – {num(q.max_marks)})
                <input type="number" min="0" max={Number(q.max_marks)} step="0.25" value={marks[q.question_id]} disabled={locked}
                  onChange={e => setMarks(m => ({ ...m, [q.question_id]: e.target.value }))} placeholder="Not graded" />
              </label>
            </>
          ) : (
            <p className="muted small">Left blank — 0 marks.</p>
          )}
        </div>
      ))}

      {!locked && gradable.length > 0 && (
        <div className="card button-row sticky-actions">
          <button className="btn btn-primary" disabled={busy || changed.length === 0}>Save marks</button>
          <span className="muted small">{changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'} to save` : 'No unsaved changes'}</span>
        </div>
      )}
    </form>
  );
}
