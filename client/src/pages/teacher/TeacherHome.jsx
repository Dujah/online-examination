import { Link } from 'react-router';
import { useAuth } from '../../auth/auth';
import { useApiData } from '../../hooks/useApiData';
import { Badge } from '../../components/ui';
import { formatDate, hhmm } from '../../format';

export default function TeacherHome() {
  const { user } = useAuth();
  const { data: subjects } = useApiData('/teaching-assignments/mine');
  const { data: exams } = useApiData('/exams');
  const { data: schedules } = useApiData('/schedules');

  const drafts = exams.filter(e => !e.is_published);
  const upcoming = schedules.filter(s => s.status === 'UPCOMING' || s.status === 'ONGOING');

  return (
    <div className="stack">
      <h1>Welcome, {user.full_name}</h1>

      <div className="stat-grid">
        <Link to="/teacher/questions" className="card stat-tile"><span className="stat-value">{subjects.length}</span><span className="stat-label">My subjects</span></Link>
        <Link to="/teacher/exams" className="card stat-tile"><span className="stat-value">{drafts.length}</span><span className="stat-label">Draft exams</span></Link>
        <Link to="/teacher/exams" className="card stat-tile"><span className="stat-value">{exams.length - drafts.length}</span><span className="stat-label">Published exams</span></Link>
        <div className="card stat-tile"><span className="stat-value">{upcoming.length}</span><span className="stat-label">Upcoming sittings</span></div>
      </div>

      <div className="two-col">
        <div className="card">
          <h2>Upcoming sittings</h2>
          {upcoming.length === 0 ? <p className="muted">Nothing scheduled.</p> : (
            <ul className="plain-list">
              {upcoming.map(s => (
                <li key={s.schedule_id}>
                  <Link to={`/teacher/exams/${s.exam_id}`}>{s.exam_title}</Link>
                  <span className="muted small"> {formatDate(s.exam_date)}, {hhmm(s.start_time)}–{hhmm(s.end_time)} </span>
                  <Badge value={s.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>My subjects</h2>
          {subjects.length === 0 ? <p className="muted">You aren't assigned to any subjects yet. Ask an admin to assign you.</p> : (
            <ul className="plain-list">
              {subjects.map(s => (
                <li key={s.subject_id}><Link to={`/teacher/questions?subject=${s.subject_id}`}>{s.subject_name}</Link></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="card">
          <h2>Drafts to finish</h2>
          <ul className="plain-list">
            {drafts.map(e => <li key={e.exam_id}><Link to={`/teacher/exams/${e.exam_id}`}>{e.exam_title}</Link> <span className="muted small">{e.total_questions} questions</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
