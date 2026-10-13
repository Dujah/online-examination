import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api';
import { useAuth } from '../../auth/auth';
import { useApiData } from '../../hooks/useApiData';
import { Badge, ErrorText } from '../../components/ui';
import { formatDate, hhmm } from '../../format';

export default function StudentHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: schedules, loading, error, reload } = useApiData('/schedules/mine');
  const { data: attempts, reload: reloadAttempts } = useApiData('/attempts');
  const [confirming, setConfirming] = useState(null); // the schedule being started
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState(false);

  // Refresh every 30s so "Start" appears when an exam opens, without a manual reload
  useEffect(() => {
    const timer = setInterval(() => { reload(); reloadAttempts(); }, 30000);
    return () => clearInterval(timer);
  }, [reload, reloadAttempts]);

  const attemptFor = (scheduleId) => attempts.find(a => a.schedule_id === scheduleId);

  // POST /attempts starts a new attempt or resumes the one in progress, and returns its id
  const start = async (schedule) => {
    setStarting(true);
    setStartError('');
    try {
      const attempt = await api.post('/attempts', { schedule_id: schedule.schedule_id });
      navigate(`/student/exam/${attempt.student_exam_id}`);
    } catch (err) {
      setStartError(err.message);
      setStarting(false);
      setConfirming(null);
      reload();
      reloadAttempts();
    }
  };

  const action = (s) => {
    const attempt = attemptFor(s.schedule_id);
    if (attempt?.status === 'COMPLETED') return <Badge value="COMPLETED" label="submitted" />;
    if (attempt?.status === 'IN_PROGRESS') return <button className="btn btn-primary" onClick={() => start(s)} disabled={starting}>Resume</button>;
    if (s.status === 'ONGOING') return <button className="btn btn-primary" onClick={() => setConfirming(s)} disabled={starting}>Start exam</button>;
    return <span className="muted small">Opens {hhmm(s.start_time)}</span>;
  };

  return (
    <div className="stack">
      <h1>Welcome, {user.full_name}</h1>
      <ErrorText error={error || startError} />

      {confirming && (
        <div className="card confirm-card">
          <h2>Start “{confirming.exam_title}”?</h2>
          <p>
            You'll have <strong>{confirming.duration_minutes} minutes</strong>, and the exam closes at {hhmm(confirming.end_time)}, whichever comes first.
            The timer keeps running if you leave the page. Your answers save automatically as you go.
          </p>
          <div className="button-row">
            <button className="btn btn-primary" onClick={() => start(confirming)} disabled={starting}>{starting ? 'Starting…' : 'Start now'}</button>
            <button className="btn" onClick={() => setConfirming(null)} disabled={starting}>Not yet</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Your exams</h2>
        {loading && schedules.length === 0 ? <p className="muted">Loading…</p> : schedules.length === 0 ? (
          <p className="muted">No upcoming exams for your semester.</p>
        ) : (
          <ul className="exam-list">
            {schedules.map(s => (
              <li key={s.schedule_id}>
                <div>
                  <div className="exam-title">{s.exam_title} <Badge value={s.status} label={s.status === 'ONGOING' ? 'open now' : undefined} /></div>
                  <div className="muted small">
                    {s.subject_name} · {formatDate(s.exam_date)}, {hhmm(s.start_time)}–{hhmm(s.end_time)} · {s.duration_minutes} min
                  </div>
                </div>
                {action(s)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="muted small">Finished exams appear in <Link to="/student/results">My results</Link> once your teacher publishes them.</p>
    </div>
  );
}
