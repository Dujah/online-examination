import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/auth';
import { api } from '../../api';

// Overview with counts, laid out in the order things need to be set up
const STEPS = [
  { key: 'departments', url: '/departments', label: 'Departments', to: '/admin/departments' },
  { key: 'courses', url: '/courses', label: 'Courses', to: '/admin/courses' },
  { key: 'semesters', url: '/semesters', label: 'Semesters', to: '/admin/semesters' },
  { key: 'subjects', url: '/subjects', label: 'Subjects', to: '/admin/subjects' },
  { key: 'teachers', url: '/users/teachers', label: 'Teachers', to: '/admin/staff' },
  { key: 'assignments', url: '/teaching-assignments', label: 'Teaching assignments', to: '/admin/assignments' }
];

// The setup checklist; a step counts as done once the records it needs exist
const SETUP = [
  {
    title: 'Departments and courses',
    text: 'Add your departments, then the courses each one offers.',
    links: [{ to: '/admin/departments', label: 'Departments' }, { to: '/admin/courses', label: 'Courses' }],
    done: c => c.departments > 0 && c.courses > 0
  },
  {
    title: 'Semesters and subjects',
    text: 'Give each course its semesters and subjects. Students pick a semester when they sign up.',
    links: [{ to: '/admin/semesters', label: 'Semesters' }, { to: '/admin/subjects', label: 'Subjects' }],
    done: c => c.semesters > 0 && c.subjects > 0
  },
  {
    title: 'Teacher accounts',
    text: 'Create an account for each teacher.',
    links: [{ to: '/admin/staff', label: 'Add teachers' }],
    done: c => c.teachers > 0
  },
  {
    title: 'Teaching assignments',
    text: 'Assign teachers to subjects. They can then build questions and exams for them.',
    links: [{ to: '/admin/assignments', label: 'Assign teachers' }],
    done: c => c.assignments > 0
  }
];

// Loads every count once; a count stays undefined while loading and null if it failed
function useCounts() {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    for (const step of STEPS) {
      api.get(step.url)
        .then(rows => setCounts(c => ({ ...c, [step.key]: rows.length })))
        .catch(() => setCounts(c => ({ ...c, [step.key]: null })));
    }
  }, []);
  return counts;
}

function StatTile({ step, count }) {
  return (
    <Link to={step.to} className="card stat-tile">
      <span className="stat-value">{count === undefined ? '…' : count ?? '–'}</span>
      <span className="stat-label">{step.label}</span>
    </Link>
  );
}

function SetupCard({ counts }) {
  const loaded = STEPS.every(s => counts[s.key] !== undefined);
  const states = SETUP.map(step => loaded && step.done(counts));
  const doneCount = states.filter(Boolean).length;
  const current = loaded ? states.indexOf(false) : -1;

  return (
    <div className="card setup-card">
      <div className="setup-head">
        <div>
          <h2>Setting up</h2>
          <p className="muted small">
            {!loaded ? 'Checking your progress…'
              : doneCount === SETUP.length ? 'All set. Teachers can start building exams.'
              : `${doneCount} of ${SETUP.length} steps done`}
          </p>
        </div>
        <div className="setup-progress" aria-hidden="true">
          <span style={{ width: `${(doneCount / SETUP.length) * 100}%` }} />
        </div>
      </div>
      <ol className="setup-steps">
        {SETUP.map((step, i) => (
          <li key={step.title} className={states[i] ? 'done' : i === current ? 'current' : ''}>
            <span className="setup-num">
              {states[i]
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="Done"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                : i + 1}
            </span>
            <div className="setup-text">
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </div>
            <div className="setup-links">
              {step.links.map(link => (
                <Link key={link.to} to={link.to} className={`btn btn-sm${i === current ? ' btn-primary' : ''}`}>{link.label}</Link>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function AdminHome() {
  const { user } = useAuth();
  const counts = useCounts();
  return (
    <div className="stack">
      <h1>Welcome, {user.full_name}</h1>
      <div className="stat-grid">
        {STEPS.map(step => <StatTile key={step.key} step={step} count={counts[step.key]} />)}
      </div>
      <SetupCard counts={counts} />
    </div>
  );
}
