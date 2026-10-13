import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/auth';

// Stroke icons for the sidebar, as SVG path data (24×24 grid)
const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21a2 2 0 0 1 2-2h13v2H6',
  calendar: 'M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10h16M8 3v4M16 3v4',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  questions: 'M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V14M12 18h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  clipboard: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 12l2 2 4-4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11'
};

function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

// Sidebar links for each role. Add an entry here when a new page is built.
const NAV = {
  ADMIN: [
    { to: '/admin', label: 'Dashboard', icon: 'home', end: true },
    { to: '/admin/departments', label: 'Departments', icon: 'building' },
    { to: '/admin/courses', label: 'Courses', icon: 'book' },
    { to: '/admin/semesters', label: 'Semesters', icon: 'calendar' },
    { to: '/admin/subjects', label: 'Subjects', icon: 'layers' },
    { to: '/admin/staff', label: 'Staff accounts', icon: 'users' },
    { to: '/admin/assignments', label: 'Teaching assignments', icon: 'link' }
  ],
  TEACHER: [
    { to: '/teacher', label: 'Dashboard', icon: 'home', end: true },
    { to: '/teacher/questions', label: 'Question bank', icon: 'questions' },
    { to: '/teacher/exams', label: 'Exams', icon: 'clipboard' }
  ],
  STUDENT: [
    { to: '/student', label: 'Dashboard', icon: 'home', end: true },
    { to: '/student/results', label: 'My results', icon: 'chart' }
  ]
};

// "Jane Q Doe" -> "JD"
function initials(name) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const home = NAV[user.role][0].to;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to={home} className="brand">
          <span className="brand-mark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          Online Examination
        </Link>
        <div className="topbar-user">
          <span className="avatar" aria-hidden="true">{initials(user.full_name)}</span>
          <span className="user-meta">
            <span className="user-name">{user.full_name}</span>
            <span className="role-badge">{user.role.toLowerCase()}</span>
          </span>
          <button className="logout-btn" onClick={handleLogout} aria-label="Log out">
            <Icon name="logout" size={16} />
            <span>Log out</span>
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className="sidebar" aria-label="Sections">
          <span className="sidebar-label">Menu</span>
          {NAV[user.role].map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
