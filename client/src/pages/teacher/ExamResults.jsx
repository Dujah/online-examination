import { Link, useParams } from 'react-router';
import { api } from '../../api';
import { useApiData } from '../../hooks/useApiData';
import { useAction } from '../../hooks/useAction';
import { Badge, ErrorText, Message } from '../../components/ui';
import { formatDate, num } from '../../format';

// Every student's attempt for one exam, grading progress, and publishing.
export default function ExamResults() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApiData(`/results/exams/${id}`, null);
  const { busy, message, run, setMessage } = useAction();

  if (loading && !data) return <p className="muted">Loading…</p>;
  if (!data) return <ErrorText error={error || 'Exam not found'} />;

  const publish = async () => {
    if (!window.confirm('Publish results? Students will see their marks, and grading will be locked. Students who never started will be marked absent.')) return;
    let res;
    if (await run(async () => { res = await api.post(`/results/exams/${id}/publish`); })) {
      setMessage({ type: 'success', text: `Published ${res.published} result${res.published === 1 ? '' : 's'}${res.marked_absent ? `, ${res.marked_absent} marked absent` : ''}.` });
      reload();
    }
  };

  // Why the publish button is disabled, so the teacher knows what to do next
  const blocker = data.results_published ? 'Results are published.'
    : !data.all_schedules_finished ? 'You can publish once every sitting has finished.'
    : data.pending_grading > 0 ? `${data.pending_grading} answer${data.pending_grading === 1 ? '' : 's'} still need grading.`
    : null;

  const completed = data.attempts.filter(a => a.status === 'COMPLETED');
  const passed = completed.filter(a => a.passed).length;

  return (
    <div className="stack">
      <p className="breadcrumb"><Link to={`/teacher/exams/${id}`}>← {data.exam_title}</Link></p>
      <div className="page-header">
        <div>
          <h1>Results</h1>
          <p className="muted">{data.exam_title} · out of {num(data.total_marks)} · pass mark {num(data.passing_marks)}</p>
        </div>
        <div className="button-row">
          {blocker && <span className="muted small">{blocker}</span>}
          <button className="btn btn-primary" onClick={publish} disabled={busy || Boolean(blocker)}>Publish results</button>
        </div>
      </div>

      <Message message={message} />
      {!message && data.results_published && <p className="msg msg-success">Results are published and visible to students.</p>}

      <div className="stat-grid">
        <div className="card stat-tile"><span className="stat-value">{completed.length}</span><span className="stat-label">Submitted</span></div>
        <div className="card stat-tile"><span className="stat-value">{data.pending_grading}</span><span className="stat-label">Answers to grade</span></div>
        <div className="card stat-tile"><span className="stat-value">{completed.length ? `${passed}/${completed.length}` : '—'}</span><span className="stat-label">Passed so far</span></div>
      </div>

      <div className="card table-wrap">
        {data.attempts.length === 0 ? <p className="muted">No one has taken this exam yet.</p> : (
          <table>
            <thead><tr><th>Student</th><th>Enrollment</th><th>Date</th><th>Status</th><th>Marks</th><th>Grade</th><th className="actions-col"></th></tr></thead>
            <tbody>
              {data.attempts.map(a => (
                <tr key={a.student_exam_id}>
                  <td>{a.full_name}</td>
                  <td>{a.enrollment_no}</td>
                  <td>{formatDate(a.exam_date)}</td>
                  <td><Badge value={a.status} /></td>
                  <td>{a.total_marks_obtained == null ? '—' : num(a.total_marks_obtained)}</td>
                  <td>{a.status === 'COMPLETED' || a.status === 'ABSENT' ? a.grade ?? '—' : '—'}</td>
                  <td className="actions-col">
                    {a.status === 'COMPLETED' && (
                      <Link className={`btn btn-sm ${a.ungraded_count > 0 ? 'btn-primary' : ''}`} to={`/teacher/grading/${a.student_exam_id}`}>
                        {a.ungraded_count > 0 ? `Grade (${a.ungraded_count})` : a.is_published ? 'View' : 'Review'}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
