import { useState } from 'react';
import { api } from '../../api';
import { useApiData } from '../../hooks/useApiData';

// Admins create teacher and admin accounts here. (Students sign themselves up on the register page.)
export default function Staff() {
  const { data: departments } = useApiData('/departments');
  const { data: teachers, loading, error: loadError, reload } = useApiData('/users/teachers');
  const blank = { full_name: '', email: '', password: '', role: 'TEACHER', department_id: '' };
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const deptName = (id) => departments.find(d => d.department_id === id)?.department_name ?? '—';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const body = { full_name: form.full_name.trim(), email: form.email.trim(), password: form.password, role: form.role };
      if (form.role === 'TEACHER') body.department_id = Number(form.department_id);
      await api.post('/auth/create-staff', body);
      setMessage({ type: 'success', text: `Created ${form.role.toLowerCase()} account for ${body.full_name}. Share the password with them securely.` });
      setForm(blank);
      reload();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <h1>Staff accounts</h1>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <h2 className="span-all">Create an account</h2>
        <label>
          Full name
          <input value={form.full_name} onChange={update('full_name')} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={update('email')} required />
        </label>
        <label>
          Temporary password
          <input type="text" value={form.password} onChange={update('password')} required minLength={6} autoComplete="off" />
        </label>
        <label>
          Role
          <select value={form.role} onChange={update('role')}>
            <option value="TEACHER">Teacher</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        {form.role === 'TEACHER' && (
          <label>
            Department
            <select value={form.department_id} onChange={update('department_id')} required>
              <option value="">Select department</option>
              {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
            </select>
          </label>
        )}
        <div className="span-all">
          <button className="btn btn-primary" disabled={busy}>Create account</button>
        </div>
      </form>

      {message && <p className={`msg msg-${message.type}`}>{message.text}</p>}
      {loadError && <p className="msg msg-error">{loadError}</p>}

      <div className="card table-wrap">
        <h2>Teachers</h2>
        {loading ? <p className="muted">Loading…</p> : teachers.length === 0 ? <p className="muted">No teachers yet.</p> : (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Department</th></tr></thead>
            <tbody>
              {[...teachers].sort((a, b) => a.full_name.localeCompare(b.full_name)).map(t => (
                <tr key={t.teacher_id}>
                  <td>{t.full_name}</td>
                  <td>{t.email}</td>
                  <td>{deptName(t.department_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
