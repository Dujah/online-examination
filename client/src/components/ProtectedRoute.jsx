import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth, HOME_BY_ROLE } from '../auth/auth';

// Wraps routes that need a logged-in user with one of the given roles.
// This only controls what the UI shows — the backend enforces the real permissions on every request.
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loading">Loading…</div>;

  if (!user) {
    // Remember where they were going, so login can send them back
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  }
  return <Outlet />;
}
