import { Link } from 'react-router';
import { useAuth } from '../../auth/auth';
import { useApiData } from '../../hooks/useApiData';

// Overview with counts, laid out in the order things need to be set up
const STEPS = [
  { key: 'departments', url: '/departments', label: 'Departments', to: '/admin/departments' },
  { key: 'courses', url: '/courses', label: 'Courses', to: '/admin/courses' },
  { key: 'semesters', url: '/semesters', label: 'Semesters', to: '/admin/semesters' },
  { key: 'subjects', url: '/subjects', label: 'Subjects', to: '/admin/subjects' },
  { key: 'teachers', url: '/users/teachers', label: 'Teachers', to: '/admin/staff' },
  { key: 'assignments', url: '/teaching-assignments', label: 'Teaching assignments', to: '/admin/assignments' }
];

function StatTile({ step }) {
  const { data, loading } = useApiData(step.url);
  return (
    <Link to={step.to} className="card stat-tile">
      <span className="stat-value">{loading ? '…' : data.length}</span>
      <span className="stat-label">{step.label}</span>
    </Link>
  );
}

export default function AdminHome() {
  const { user } = useAuth();
  return (
    <div className="stack">
      <h1>Welcome, {user.full_name}</h1>
      <div className="stat-grid">
        {STEPS.map(step => <StatTile key={step.key} step={step} />)}
      </div>
      <div className="card">
        <h2>Setting up</h2>
        <ol className="setup-steps">
          <li>Add <Link to="/admin/departments">departments</Link>, then their <Link to="/admin/courses">courses</Link>.</li>
          <li>Give each course its <Link to="/admin/semesters">semesters</Link> and <Link to="/admin/subjects">subjects</Link>. Students pick a semester when they sign up.</li>
          <li>Create <Link to="/admin/staff">teacher accounts</Link>.</li>
          <li><Link to="/admin/assignments">Assign teachers to subjects</Link>. Teachers can then build questions and exams for them.</li>
        </ol>
      </div>
    </div>
  );
}
