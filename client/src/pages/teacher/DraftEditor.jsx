import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api';
import { useApiData } from '../../hooks/useApiData';
import { useAction } from '../../hooks/useAction';
import { Badge, Message } from '../../components/ui';
import { num } from '../../format';

// Picks questions from the subject's bank into the exam paper, in order, then publishes.
// The parent remounts this (via `key`) whenever the saved question list changes,
// so `initial` is always the saved state and "unsaved changes" is just a comparison.
export default function DraftEditor({ exam, onChanged }) {
  const { data: bank, loading } = useApiData(`/questions?subject_id=${exam.subject_id}`);
  const initial = exam.questions;
  const [paper, setPaper] = useState(initial);
  const [search, setSearch] = useState('');
  const { busy, message, run, setMessage } = useAction();

  const dirty = paper.map(q => q.question_id).join() !== initial.map(q => q.question_id).join();
  const total = paper.reduce((sum, q) => sum + Number(q.marks), 0);
  const onPaper = new Set(paper.map(q => q.question_id));
  const available = bank.filter(q => !onPaper.has(q.question_id) && q.question_text.toLowerCase().includes(search.toLowerCase()));

  const add = (q) => { setMessage(null); setPaper(p => [...p, q]); };
  const remove = (id) => { setMessage(null); setPaper(p => p.filter(q => q.question_id !== id)); };
  const move = (index, delta) => {
    setMessage(null);
    setPaper(p => {
      const next = [...p];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  };

  const save = async () => {
    if (await run(() => api.put(`/exams/${exam.exam_id}/questions`, { question_ids: paper.map(q => q.question_id) }))) {
      onChanged('Questions saved.');
    }
  };

  const publish = async () => {
    if (!window.confirm('Publish this exam? Its questions and settings will be locked. You can schedule it once it is published.')) return;
    if (await run(() => api.patch(`/exams/${exam.exam_id}/publish`))) onChanged('Exam published. Now add a schedule so students can take it.');
  };

  const passingTooHigh = Number(exam.passing_marks) > total;

  return (
    <div className="stack">
      <div className="builder">
        <section className="card builder-col">
          <h2>Question bank</h2>
          <input type="search" placeholder="Search questions…" value={search} onChange={e => setSearch(e.target.value)} />
          {loading ? <p className="muted">Loading…</p> : bank.length === 0 ? (
            <p className="muted">This subject has no questions yet. <Link to={`/teacher/questions?subject=${exam.subject_id}`}>Add some in the question bank.</Link></p>
          ) : available.length === 0 ? <p className="muted">{search ? 'No matching questions.' : 'Every question is already on the paper.'}</p> : (
            <ul className="pick-list">
              {available.map(q => (
                <li key={q.question_id}>
                  <div className="pick-text">
                    <span>{q.question_text}</span>
                    <span className="pick-meta"><Badge value={q.question_type} label={q.question_type === 'MCQ' ? 'MCQ' : 'theory'} /> {num(q.marks)} marks</span>
                  </div>
                  <button className="btn btn-sm" onClick={() => add(q)}>Add</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card builder-col">
          <h2>Exam paper <span className="muted small">— {paper.length} question{paper.length === 1 ? '' : 's'}, {num(total)} marks</span></h2>
          {paper.length === 0 ? <p className="muted">Add questions from the bank.</p> : (
            <ol className="pick-list paper-list">
              {paper.map((q, i) => (
                <li key={q.question_id}>
                  <span className="seq">{i + 1}</span>
                  <div className="pick-text">
                    <span>{q.question_text}</span>
                    <span className="pick-meta"><Badge value={q.question_type} label={q.question_type === 'MCQ' ? 'MCQ' : 'theory'} /> {num(q.marks)} marks</span>
                  </div>
                  <div className="row-buttons">
                    <button className="btn btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button className="btn btn-sm" onClick={() => move(i, 1)} disabled={i === paper.length - 1} aria-label="Move down">↓</button>
                    <button className="btn btn-sm btn-danger-outline" onClick={() => remove(q.question_id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <Message message={message} />
      <div className="card button-row">
        <button className="btn btn-primary" onClick={save} disabled={busy || !dirty}>Save questions</button>
        {dirty && <button className="btn" onClick={() => setPaper(initial)} disabled={busy}>Discard changes</button>}
        <span className="spacer" />
        {/* Publishing checks the saved paper on the server, so unsaved edits must be saved first */}
        <span className="muted small">
          {dirty ? 'Save your changes before publishing.'
            : initial.length === 0 ? 'Add questions to publish.'
            : passingTooHigh ? `Passing marks (${num(exam.passing_marks)}) are higher than the total (${num(total)}).` : ''}
        </span>
        <button className="btn btn-primary" onClick={publish} disabled={busy || dirty || initial.length === 0 || passingTooHigh}>Publish exam</button>
      </div>
    </div>
  );
}
