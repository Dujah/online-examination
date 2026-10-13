import { useState } from 'react';
import { api } from '../../api';
import { useApiData } from '../../hooks/useApiData';

// Which teacher teaches which subject. A teacher can only write questions and exams for subjects assigned here.
export default function Assignments() {
  const { data: teachers } = useApiData('/users/teachers');
  const { data: subjects } = useApiData('/subjects');
  const { data: courses } = useApiData('/courses');
  const { data: assignments, loading, error: loadError, reload } = useApiData('/teaching-assignments');
  const [form, setForm] = useState({ teacher_id: '', subject_id: '' });
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const teacherName = (id) => teachers.find(t => t.teacher_id === id)?.full_name ?? `Teacher #${id}`;
  const courseName = (id) => courses.find(c => c.course_id === id)?.course_name ?? '';
  const subjectLabel = (id) => {
    const s = subjects.find(x => x.subject_id === id);
    return s ? `${s.subject_name} (${courseName(s.course_id)})` : `Subject #${id}`;
  };

  const run = async (action, successText) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ type: 'success', text: successText });
      reload();
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    const ok = await run(
      () => api.post('/teaching-assignments', { teacher_id: Number(form.teacher_id), subject_id: Number(form.subject_id) }),
      `Assigned ${teacherName(Number(form.teacher_id))} to ${subjectLabel(Number(form.subject_id))}.`
    );
    if (ok) setForm({ teacher_id: '', subject_id: '' });
  };

  const handleRemove = async (a) => {
    if (!window.confirm(`Remove ${teacherName(a.teacher_id)} from ${subjectLabel(a.subject_id)}?`)) return;
    await run(() => api.delete(`/teaching-assignments/${a.assignment_id}`), 'Assignment removed.');
  };

  const sorted = [...assignments].sort((a, b) =>
    teacherName(a.teacher_id).localeCompare(teacherName(b.teacher_id)) || subjectLabel(a.subject_id).localeCompare(subjectLabel(b.subject_id)));

  return (
    <div className="stack">
      <h1>Teaching assignments</h1>

      <form className="card inline-form" onSubmit={handleAssign}>
        <label>
          Teacher
          <select value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))} required>
            <option value="">Select teacher</option>
            {teachers.map(t => <option key={t.teacher_id} value={t.teacher_id}>{t.full_name}</option>)}
          </select>
        </label>
        <label>
          Subject
          <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))} required>
            <option value="">Select subject</option>
            {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{subjectLabel(s.subject_id)}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" disabled={busy}>Assign</button>
      </form>

      {message && <p className={`msg msg-${message.type}`}>{message.text}</p>}
      {loadError && <p className="msg msg-error">{loadError}</p>}

      <div className="card table-wrap">
        {loading ? <p className="muted">Loading…</p> : sorted.length === 0 ? <p className="muted">No assignments yet.</p> : (
          <table>
            <thead><tr><th>Teacher</th><th>Subject</th><th className="actions-col"></th></tr></thead>
            <tbody>
              {sorted.map(a => (
                <tr key={a.assignment_id}>
                  <td>{teacherName(a.teacher_id)}</td>
                  <td>{subjectLabel(a.subject_id)}</td>
                  <td className="actions-col">
                    <button className="btn btn-sm btn-danger-outline" disabled={busy} onClick={() => handleRemove(a)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
