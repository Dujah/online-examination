import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { api } from '../api';
import { useAuth, HOME_BY_ROLE } from '../auth/auth';

// Public sign-up — always creates a STUDENT. Teachers and admins are created by an admin.
export default function Register() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', enrollment_no: '', course_id: '', semester_id: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/courses'), api.get('/semesters')])
      .then(([c, s]) => { setCourses(c); setSemesters(s); })
      .catch(err => setError(err.message));
  }, []);

  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  const update = (field) => (e) => {
    const value = e.target.value;
    // Changing the course clears the semester, since semesters belong to a course
    setForm(f => field === 'course_id' ? { ...f, course_id: value, semester_id: '' } : { ...f, [field]: value });
  };

  const courseSemesters = semesters
    .filter(s => String(s.course_id) === form.course_id)
    .sort((a, b) => a.semester_number - b.semester_number);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // course_id only drives the semester dropdown; the backend needs just the semester
      const { full_name, email, password, enrollment_no, semester_id } = form;
      await api.post('/auth/register', { full_name, email, password, enrollment_no, semester_id });
      await login(form.email, form.password); // sign straight in after registering
      navigate(HOME_BY_ROLE.STUDENT, { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Student sign-up</h1>
        <label>
          Full name
          <input value={form.full_name} onChange={update('full_name')} required autoFocus />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={update('email')} required />
        </label>
        <label>
          Password
          <input type="password" value={form.password} onChange={update('password')} required minLength={6} />
        </label>
        <label>
          Enrollment number
          <input value={form.enrollment_no} onChange={update('enrollment_no')} required />
        </label>
        <label>
          Course
          <select value={form.course_id} onChange={update('course_id')} required>
            <option value="">Select a course</option>
            {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
          </select>
        </label>
        <label>
          Semester
          <select value={form.semester_id} onChange={update('semester_id')} required disabled={!form.course_id}>
            <option value="">{form.course_id ? 'Select a semester' : 'Pick a course first'}</option>
            {courseSemesters.map(s => <option key={s.semester_id} value={s.semester_id}>Semester {s.semester_number}</option>)}
          </select>
        </label>
        {error && <p className="msg msg-error">{error}</p>}
        <button className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
