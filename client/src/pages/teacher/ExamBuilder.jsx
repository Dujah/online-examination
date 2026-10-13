import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api';
import { useApiData } from '../../hooks/useApiData';
import { useAction } from '../../hooks/useAction';
import { Badge, ErrorText, Message } from '../../components/ui';
import { num } from '../../format';
import ExamSettings from './ExamSettings';
import DraftEditor from './DraftEditor';
import ExamSchedules from './ExamSchedules';

// One exam, start to finish:
//   draft     → settings + question picker + publish
//   published → read-only paper + schedules + results
export default function ExamBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: exam, loading, error, reload } = useApiData(`/exams/${id}`, null);
  const { busy, message, run, setMessage } = useAction();

  if (loading && !exam) return <p className="muted">Loading…</p>;
  if (!exam) return <ErrorText error={error || 'Exam not found'} />;

  const changed = (text) => {
    setMessage(text ? { type: 'success', text } : null);
    reload();
  };

  const unpublish = async () => {
    if (await run(() => api.patch(`/exams/${exam.exam_id}/unpublish`))) changed('Exam is back to draft. You can edit it again.');
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${exam.exam_title}"? This cannot be undone.`)) return;
    if (await run(() => api.delete(`/exams/${exam.exam_id}`))) navigate('/teacher/exams', { replace: true });
  };

  // Remount the editors when the saved data changes, so their local state starts from the saved version
  const questionsKey = exam.questions.map(q => q.question_id).join();

  return (
    <div className="stack">
      <p className="breadcrumb"><Link to="/teacher/exams">← Exams</Link></p>
      <div className="page-header">
        <div>
          <h1>{exam.exam_title}</h1>
          <p className="muted">
            <Badge value={exam.is_published ? 'PUBLISHED' : 'DRAFT'} /> {exam.total_questions} questions · {num(exam.total_marks)} marks · {exam.duration_minutes} min
          </p>
        </div>
        <div className="button-row">
          {exam.is_published ? (
            <>
              <Link className="btn btn-primary" to={`/teacher/exams/${exam.exam_id}/results`}>Results &amp; grading</Link>
              <button className="btn" onClick={unpublish} disabled={busy}>Unpublish</button>
            </>
          ) : (
            <button className="btn btn-danger-outline" onClick={remove} disabled={busy}>Delete exam</button>
          )}
        </div>
      </div>

      <Message message={message} />

      <ExamSettings key={`${exam.updated_at}-${exam.is_published}`} exam={exam} onSaved={changed} />

      {exam.is_published ? (
        <>
          <ExamSchedules exam={exam} />
          <div className="card">
            <h2>Exam paper</h2>
            <ol className="paper-readonly">
              {exam.questions.map(q => (
                <li key={q.question_id}>
                  <div className="paper-q">
                    <span>{q.question_text}</span>
                    <span className="muted small">{num(q.marks)} marks</span>
                  </div>
                  {q.options && (
                    <ul className="option-list">
                      {q.options.map(o => <li key={o.option_id} className={o.is_correct ? 'correct' : ''}>{o.option_text}{o.is_correct ? ' ✓' : ''}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : (
        <DraftEditor key={questionsKey} exam={exam} onChanged={changed} />
      )}
    </div>
  );
}
