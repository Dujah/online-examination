import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/auth';

// Sidebar links for each role. Add an entry here when a new page is built.
const NAV = {
  ADMIN: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/departments', label: 'Departments' },
    { to: '/admin/courses', label: 'Courses' },
    { to: '/admin/semesters', label: 'Semesters' },
    { to: '/admin/subjects', label: 'Subjects' },
    { to: '/admin/staff', label: 'Staff accounts' },
    { to: '/admin/assignments', label: 'Teaching assignments' }
  ],
  TEACHER: [
    { to: '/teacher', label: 'Dashboard', end: true },
    { to: '/teacher/questions', label: 'Question bank' },
    { to: '/teacher/exams', label: 'Exams' }
  ],
  STUDENT: [
    { to: '/student', label: 'Dashboard', end: true },
    { to: '/student/results', label: 'My results' }
  ]
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">Online Examination</span>
        <div className="topbar-user">
          <span>{user.full_name} <span className="role-badge">{user.role.toLowerCase()}</span></span>
          <button className="btn btn-ghost" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <div className="app-body">
        <nav className="sidebar">
          {NAV[user.role].map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
              {item.label}
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
