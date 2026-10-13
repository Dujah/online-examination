import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api';
import { useApiData } from '../../hooks/useApiData';
import { useAction } from '../../hooks/useAction';
import { Badge, ErrorText, Message } from '../../components/ui';
import { num } from '../../format';

const blank = { subject_id: '', semester_id: '', exam_title: '', duration_minutes: '60', passing_marks: '0', randomize_questions: true };

export default function Exams() {
  const navigate = useNavigate();
  const { data: exams, loading, error } = useApiData('/exams');
  const { data: subjects } = useApiData('/teaching-assignments/mine');
  const { data: semesters } = useApiData('/semesters');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blank);
  const { busy, message, run } = useAction();

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    // A new subject may belong to a different course, so its semesters differ
    setForm(f => field === 'subject_id' ? { ...f, subject_id: value, semester_id: '' } : { ...f, [field]: value });
  };

  // Only semesters of the chosen subject's course (the backend requires they match)
  const subject = subjects.find(s => String(s.subject_id) === form.subject_id);
  const subjectSemesters = semesters
    .filter(s => subject && s.course_id === subject.course_id)
    .sort((a, b) => a.semester_number - b.semester_number);

  const handleCreate = async (e) => {
    e.preventDefault();
    let created;
    const ok = await run(async () => {
      created = await api.post('/exams', {
        subject_id: Number(form.subject_id),
        semester_id: Number(form.semester_id),
        exam_title: form.exam_title.trim(),
        duration_minutes: Number(form.duration_minutes),
        passing_marks: Number(form.passing_marks),
        randomize_questions: form.randomize_questions
      });
    });
    // Straight into the builder to add questions
    if (ok) navigate(`/teacher/exams/${created.exam_id}`);
  };

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Exams</h1>
        {!creating && <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New exam</button>}
      </div>

      {creating && (
        <form className="card form-grid" onSubmit={handleCreate}>
          <h2 className="span-all">New exam</h2>
          <label className="span-all">
            Title
            <input value={form.exam_title} onChange={update('exam_title')} required maxLength={150} autoFocus placeholder="e.g. Data Structures — Midterm" />
          </label>
          <label>
            Subject
            <select value={form.subject_id} onChange={update('subject_id')} required>
              <option value="">Select subject</option>
              {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}
            </select>
          </label>
          <label>
            Semester
            <select value={form.semester_id} onChange={update('semester_id')} required disabled={!subject}>
              <option value="">{subject ? 'Select semester' : 'Pick a subject first'}</option>
              {subjectSemesters.map(s => <option key={s.semester_id} value={s.semester_id}>Semester {s.semester_number}</option>)}
            </select>
          </label>
          <label>
            Duration (minutes)
            <input type="number" min="1" step="1" value={form.duration_minutes} onChange={update('duration_minutes')} required />
          </label>
          <label>
            Passing marks
            <input type="number" min="0" step="0.01" value={form.passing_marks} onChange={update('passing_marks')} required />
          </label>
          <label className="checkbox span-all">
            <input type="checkbox" checked={form.randomize_questions} onChange={update('randomize_questions')} />
            Shuffle question order for each student
          </label>
          <Message message={message} />
          <div className="button-row span-all">
            <button className="btn btn-primary" disabled={busy}>Create and add questions</button>
            <button type="button" className="btn" onClick={() => { setCreating(false); setForm(blank); }}>Cancel</button>
          </div>
        </form>
      )}

      <ErrorText error={error} />
      <div className="card table-wrap">
        {loading ? <p className="muted">Loading…</p> : exams.length === 0 ? <p className="muted">No exams yet. Create one to get started.</p> : (
          <table>
            <thead><tr><th>Title</th><th>Subject</th><th>Semester</th><th>Questions</th><th>Total marks</th><th>Status</th></tr></thead>
            <tbody>
              {exams.map(e => (
                <tr key={e.exam_id}>
                  <td><Link to={`/teacher/exams/${e.exam_id}`}>{e.exam_title}</Link></td>
                  <td>{e.subject_name}</td>
                  <td>{e.semester_number}</td>
                  <td>{e.total_questions}</td>
                  <td>{num(e.total_marks)}</td>
                  <td><Badge value={e.is_published ? 'PUBLISHED' : 'DRAFT'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
