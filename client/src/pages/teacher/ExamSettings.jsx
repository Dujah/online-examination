import { useState } from 'react';
import { api } from '../../api';
import { useApiData } from '../../hooks/useApiData';
import { useAction } from '../../hooks/useAction';
import { Message } from '../../components/ui';
import { num } from '../../format';

// Exam settings. Editable while the exam is a draft; read-only once published.
export default function ExamSettings({ exam, onSaved }) {
  const { data: subjects } = useApiData('/subjects');
  const { data: semesters } = useApiData('/semesters');
  const [form, setForm] = useState({
    exam_title: exam.exam_title,
    semester_id: String(exam.semester_id),
    duration_minutes: String(exam.duration_minutes),
    passing_marks: num(exam.passing_marks),
    randomize_questions: Boolean(exam.randomize_questions)
  });
  const { busy, message, run } = useAction();

  const courseId = subjects.find(s => s.subject_id === exam.subject_id)?.course_id;
  const courseSemesters = semesters.filter(s => s.course_id === courseId).sort((a, b) => a.semester_number - b.semester_number);
  const semesterLabel = (id) => `Semester ${semesters.find(s => s.semester_id === Number(id))?.semester_number ?? ''}`;

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const ok = await run(() => api.put(`/exams/${exam.exam_id}`, {
      exam_title: form.exam_title.trim(),
      semester_id: Number(form.semester_id),
      duration_minutes: Number(form.duration_minutes),
      passing_marks: Number(form.passing_marks),
      randomize_questions: form.randomize_questions
    }));
    // The parent shows the confirmation: this form remounts after saving and would lose its own message
    if (ok) onSaved('Settings saved.');
  };

  if (exam.is_published) {
    return (
      <div className="card">
        <h2>Settings</h2>
        <dl className="details">
          <dt>Semester</dt><dd>{semesterLabel(exam.semester_id)}</dd>
          <dt>Duration</dt><dd>{exam.duration_minutes} minutes</dd>
          <dt>Passing marks</dt><dd>{num(exam.passing_marks)} of {num(exam.total_marks)}</dd>
          <dt>Question order</dt><dd>{exam.randomize_questions ? 'Shuffled for each student' : 'Same for everyone'}</dd>
        </dl>
      </div>
    );
  }

  return (
    <form className="card form-grid" onSubmit={handleSave}>
      <h2 className="span-all">Settings</h2>
      <label className="span-all">
        Title
        <input value={form.exam_title} onChange={update('exam_title')} required maxLength={150} />
      </label>
      <label>
        Semester
        <select value={form.semester_id} onChange={update('semester_id')} required>
          {courseSemesters.map(s => <option key={s.semester_id} value={s.semester_id}>Semester {s.semester_number}</option>)}
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
      <div className="span-all">
        <button className="btn btn-primary" disabled={busy}>Save settings</button>
      </div>
    </form>
  );
}
