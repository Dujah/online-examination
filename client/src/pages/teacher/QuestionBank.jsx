import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../api';
import { useAuth } from '../../auth/auth';
import { useApiData } from '../../hooks/useApiData';
import { useAction } from '../../hooks/useAction';
import { Badge, ErrorText, Message } from '../../components/ui';
import { num } from '../../format';
import QuestionForm from './QuestionForm';

export default function QuestionBank() {
  const { user } = useAuth();
  const { data: subjects } = useApiData('/teaching-assignments/mine');
  // The chosen subject lives in the URL (?subject=3) so a reload or a link keeps it
  const [params, setParams] = useSearchParams();
  const subjectId = params.get('subject') || '';
  const { data: questions, loading, error, reload } = useApiData(subjectId ? `/questions?subject_id=${subjectId}` : null);

  const [editor, setEditor] = useState(null); // null | { question } (question undefined = new)
  const { busy, message, run, setMessage } = useAction();

  const chooseSubject = (id) => {
    setEditor(null);
    setMessage(null);
    setParams(id ? { subject: id } : {});
  };

  const openEdit = async (q) => {
    setMessage(null);
    // The list doesn't include options, so load the full question first
    let full;
    if (await run(async () => { full = await api.get(`/questions/${q.question_id}`); })) setEditor({ question: full });
  };

  const handleDelete = async (q) => {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    if (await run(() => api.delete(`/questions/${q.question_id}`), 'Question deleted.')) reload();
  };

  const handleSaved = (text) => {
    setEditor(null);
    setMessage({ type: 'success', text });
    reload();
  };

  return (
    <div className="stack">
      <h1>Question bank</h1>

      <div className="card inline-form">
        <label>
          Subject
          <select value={subjectId} onChange={e => chooseSubject(e.target.value)}>
            <option value="">Select one of your subjects</option>
            {subjects.map(s => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}
          </select>
        </label>
        {subjectId && !editor && (
          <button className="btn btn-primary" onClick={() => { setMessage(null); setEditor({}); }}>+ New question</button>
        )}
      </div>

      {subjects.length === 0 && <p className="muted">You aren't assigned to any subjects yet. Ask an admin to assign you.</p>}

      {editor && (
        <QuestionForm key={editor.question?.question_id ?? 'new'} subjectId={subjectId} question={editor.question}
          onSaved={handleSaved} onCancel={() => setEditor(null)} />
      )}

      <Message message={message} />
      <ErrorText error={error} />

      {subjectId && (
        <div className="card table-wrap">
          {loading ? <p className="muted">Loading…</p> : questions.length === 0 ? <p className="muted">No questions in this subject yet.</p> : (
            <table>
              <thead><tr><th>Question</th><th>Type</th><th>Marks</th><th className="actions-col"></th></tr></thead>
              <tbody>
                {questions.map(q => {
                  const mine = q.created_by === user.user_id;
                  return (
                    <tr key={q.question_id}>
                      <td className="question-cell">{q.question_text}</td>
                      <td><Badge value={q.question_type} label={q.question_type === 'MCQ' ? 'MCQ' : 'theory'} /></td>
                      <td>{num(q.marks)}</td>
                      <td className="actions-col">
                        {/* Teachers can only change their own questions (the backend enforces this too) */}
                        {mine ? (
                          <>
                            <button className="btn btn-sm" disabled={busy} onClick={() => openEdit(q)}>Edit</button>
                            <button className="btn btn-sm btn-danger-outline" disabled={busy} onClick={() => handleDelete(q)}>Delete</button>
                          </>
                        ) : <span className="muted small">another teacher's</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
