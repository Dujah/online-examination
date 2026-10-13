import { Link, useParams } from 'react-router';
import { useApiData } from '../../hooks/useApiData';
import { Badge, ErrorText } from '../../components/ui';
import { formatDate, num } from '../../format';

// Published results only — the backend never returns unpublished ones to students
export function Results() {
  const { data: results, loading, error } = useApiData('/results/mine');

  return (
    <div className="stack">
      <h1>My results</h1>
      <ErrorText error={error} />
      <div className="card table-wrap">
        {loading ? <p className="muted">Loading…</p> : results.length === 0 ? (
          <p className="muted">No results yet. They appear here once your teacher publishes them.</p>
        ) : (
          <table>
            <thead><tr><th>Exam</th><th>Subject</th><th>Date</th><th>Marks</th><th>Grade</th><th>Result</th></tr></thead>
            <tbody>
              {results.map(r => (
                <tr key={r.student_exam_id}>
                  <td>{r.status === 'ABSENT' ? r.exam_title : <Link to={`/student/results/${r.student_exam_id}`}>{r.exam_title}</Link>}</td>
                  <td>{r.subject_name}</td>
                  <td>{formatDate(r.exam_date)}</td>
                  <td>{num(r.total_marks_obtained)} / {num(r.total_marks)} <span className="muted small">({num(r.percentage)}%)</span></td>
                  <td>{r.grade}</td>
                  <td>{r.status === 'ABSENT' ? <Badge value="ABSENT" /> : <Badge value={r.passed ? 'COMPLETED' : 'CANCELLED'} label={r.passed ? 'passed' : 'not passed'} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function ResultDetail() {
  const { id } = useParams();
  const { data: result, loading, error } = useApiData(`/results/mine/${id}`, null);

  if (loading && !result) return <p className="muted">Loading…</p>;
  if (!result) return <><ErrorText error={error || 'Result not found'} /><Link to="/student/results">← My results</Link></>;

  return (
    <div className="stack">
      <p className="breadcrumb"><Link to="/student/results">← My results</Link></p>
      <div className="page-header">
        <div>
          <h1>{result.exam_title}</h1>
          <p className="muted">Pass mark {num(result.passing_marks)} of {num(result.total_marks)}</p>
        </div>
        <div className="score-box">
          <span className="stat-value">{num(result.total_marks_obtained)} / {num(result.total_marks)}</span>
          <span className="small">Grade {result.grade} · <Badge value={result.passed ? 'COMPLETED' : 'CANCELLED'} label={result.passed ? 'passed' : 'not passed'} /></span>
        </div>
      </div>

      {result.questions.map((q, i) => (
        <div key={q.question_id} className="card answer-card">
          <div className="paper-q">
            <span><strong>Q{i + 1}.</strong> {q.question_text}</span>
            <span className={`small ${Number(q.marks_obtained) === Number(q.max_marks) ? 'text-success' : 'muted'}`}>
              {num(q.marks_obtained)} / {num(q.max_marks)}
            </span>
          </div>
          {q.question_type === 'MCQ' ? (
            <ul className="option-list">
              {q.options.map(o => (
                <li key={o.option_id} className={[o.is_correct && 'correct', o.option_id === q.selected_option_id && !o.is_correct && 'wrong'].filter(Boolean).join(' ')}>
                  {o.option_text}
                  {o.option_id === q.selected_option_id && <span className="small"> ← your answer</span>}
                  {o.is_correct && ' ✓'}
                </li>
              ))}
              {q.selected_option_id == null && <li className="muted">You didn't answer this question.</li>}
            </ul>
          ) : q.written_answer?.trim() ? (
            <blockquote className="written-answer">{q.written_answer}</blockquote>
          ) : <p className="muted small">You didn't answer this question.</p>}
        </div>
      ))}
    </div>
  );
}
