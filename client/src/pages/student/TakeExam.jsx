import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../api';
import { useApiData } from '../../hooks/useApiData';
import { ErrorText } from '../../components/ui';
import { num } from '../../format';

const SAVE_DELAY_MS = 800;   // wait this long after the last change before saving
const RETRY_DELAY_MS = 3000; // retry a failed save after this long

// The exam-taking screen. Full screen (no sidebar) to keep the student focused.
export default function TakeExam() {
  const { id } = useParams();
  const { data: attempt, loading, error, reload } = useApiData(`/attempts/${id}`, null);
  const [closedReason, setClosedReason] = useState('');

  if (loading && !attempt) return <div className="exam-shell"><p className="muted">Loading…</p></div>;
  if (!attempt) return <div className="exam-shell"><ErrorText error={error || 'Exam not found'} /><Link to="/student">Back to dashboard</Link></div>;

  if (attempt.status !== 'IN_PROGRESS') {
    return (
      <div className="exam-shell">
        <div className="card done-card">
          <h1>Exam submitted</h1>
          <p>{closedReason || 'Your answers have been submitted.'}</p>
          <p className="muted">Your result will appear in <strong>My results</strong> once your teacher has graded the exam and published the results.</p>
          <Link className="btn btn-primary" to="/student">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  return <ExamSession attempt={attempt} onClosed={(reason) => { setClosedReason(reason); reload(); }} />;
}

function ExamSession({ attempt, onClosed }) {
  const questions = attempt.questions;
  const [answers, setAnswers] = useState(() => Object.fromEntries(questions.map(q => [q.question_id, {
    selected_option_id: q.selected_option_id, written_answer: q.written_answer ?? ''
  }])));
  const [current, setCurrent] = useState(0);
  const [saveState, setSaveState] = useState('saved'); // saved | unsaved | saving | error
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // The server's remaining time, turned into a local deadline. Re-synced after every save,
  // so a wrong clock on the student's computer can't add or remove time.
  const [deadline, setDeadline] = useState(() => Date.now() + attempt.seconds_remaining * 1000);
  const [now, setNow] = useState(() => Date.now());

  // Refs hold save bookkeeping that must not trigger re-renders
  const dirty = useRef(new Map());   // question_id -> payload not yet saved
  const saveTimer = useRef(null);
  const saving = useRef(false);
  const submitting = useRef(false);

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (saving.current) {
      // A save is in flight; try again shortly so changes made meanwhile aren't lost
      saveTimer.current = setTimeout(() => flush(), 200);
      return false;
    }
    if (dirty.current.size === 0) return true;

    const batch = [...dirty.current.values()];
    dirty.current.clear();
    saving.current = true;
    setSaveState('saving');
    try {
      const res = await api.put(`/attempts/${attempt.student_exam_id}/answers`, { answers: batch });
      setDeadline(Date.now() + res.seconds_remaining * 1000);
      setSaveState(dirty.current.size ? 'unsaved' : 'saved');
      if (dirty.current.size) saveTimer.current = setTimeout(() => flush(), SAVE_DELAY_MS);
      return true;
    } catch (err) {
      // Put the batch back, unless the student changed that answer again meanwhile
      for (const a of batch) if (!dirty.current.has(a.question_id)) dirty.current.set(a.question_id, a);
      if (err.status === 409) {
        // Time ran out or it was already submitted — the server has closed the attempt
        onClosed(err.message);
        return false;
      }
      setSaveState('error');
      saveTimer.current = setTimeout(() => flush(), RETRY_DELAY_MS);
      return false;
    } finally {
      saving.current = false;
    }
  }, [attempt.student_exam_id, onClosed]);

  const setAnswer = (question, patch) => {
    const next = { ...answers[question.question_id], ...patch };
    setAnswers(a => ({ ...a, [question.question_id]: next }));
    dirty.current.set(question.question_id, question.question_type === 'MCQ'
      ? { question_id: question.question_id, selected_option_id: next.selected_option_id }
      : { question_id: question.question_id, written_answer: next.written_answer });
    setSaveState('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flush(), SAVE_DELAY_MS);
  };

  const submit = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    setSubmitError('');
    // Let an in-flight save finish, then send anything still pending — otherwise the submit
    // could reach the server first and the last answer would be lost
    while (saving.current) await new Promise(r => setTimeout(r, 100));
    await flush();
    try {
      await api.post(`/attempts/${attempt.student_exam_id}/submit`);
      onClosed('Your answers have been submitted.');
    } catch (err) {
      if (err.status === 409) onClosed(err.message);
      else {
        setSubmitError(`${err.message} Your saved answers are safe — try submitting again.`);
        submitting.current = false;
      }
    }
  }, [attempt.student_exam_id, flush, onClosed]);

  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));

  // Tick the clock once a second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Time's up: save what's pending and submit automatically
  useEffect(() => {
    if (remaining === 0) submit();
  }, [remaining, submit]);

  // Don't wait for the autosave delay when the student leaves:
  // - tab hidden (switching tabs, closing the laptop lid): save straight away
  // - page unloading (reload, closing the tab): a normal request would be cancelled, but a
  //   keepalive request is finished by the browser even after the page is gone
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    const onPageHide = () => {
      if (dirty.current.size === 0) return;
      fetch(`/api/attempts/${attempt.student_exam_id}/answers`, {
        method: 'PUT', keepalive: true, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: [...dirty.current.values()] })
      });
      dirty.current.clear();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flush, attempt.student_exam_id]);

  // Warn before closing the tab while an answer hasn't reached the server
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (dirty.current.size || saving.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      clearTimeout(saveTimer.current);
    };
  }, []);

  const isAnswered = (q) => q.question_type === 'MCQ'
    ? answers[q.question_id].selected_option_id != null
    : answers[q.question_id].written_answer.trim() !== '';
  const unanswered = questions.filter(q => !isAnswered(q)).length;
  const q = questions[current];

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');
  const saveLabel = { saved: 'All answers saved', unsaved: 'Unsaved changes…', saving: 'Saving…', error: 'Connection problem — retrying…' }[saveState];

  return (
    <div className="exam-shell">
      <header className="exam-header card">
        <div>
          <h1>{attempt.exam_title}</h1>
          <span className={`save-state save-${saveState}`}>{saveLabel}</span>
        </div>
        <div className={`timer ${remaining <= 300 ? 'timer-low' : ''}`} role="timer" aria-label="Time remaining">
          {minutes}:{seconds}
        </div>
      </header>

      <div className="exam-body">
        <nav className="card palette" aria-label="Questions">
          <div className="palette-grid">
            {questions.map((qq, i) => (
              <button key={qq.question_id} type="button" onClick={() => setCurrent(i)}
                className={`palette-btn ${isAnswered(qq) ? 'answered' : ''} ${i === current ? 'current' : ''}`}
                aria-label={`Question ${i + 1}${isAnswered(qq) ? ', answered' : ''}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <p className="muted small">{questions.length - unanswered} of {questions.length} answered</p>
          <button className="btn btn-primary" onClick={() => setConfirmSubmit(true)}>Submit exam</button>
        </nav>

        <section className="card question-pane">
          <div className="paper-q">
            <span className="muted">Question {current + 1} of {questions.length}</span>
            <span className="muted small">{num(q.marks)} mark{Number(q.marks) === 1 ? '' : 's'}</span>
          </div>
          <p className="question-text">{q.question_text}</p>

          {q.question_type === 'MCQ' ? (
            <div className="choices" role="radiogroup">
              {q.options.map(o => (
                <label key={o.option_id} className={`choice ${answers[q.question_id].selected_option_id === o.option_id ? 'chosen' : ''}`}>
                  <input type="radio" name={`q-${q.question_id}`} checked={answers[q.question_id].selected_option_id === o.option_id}
                    onChange={() => setAnswer(q, { selected_option_id: o.option_id })} />
                  {o.option_text}
                </label>
              ))}
              {answers[q.question_id].selected_option_id != null && (
                <button type="button" className="btn btn-sm clear-choice" onClick={() => setAnswer(q, { selected_option_id: null })}>Clear answer</button>
              )}
            </div>
          ) : (
            <textarea className="answer-box" rows={10} value={answers[q.question_id].written_answer} maxLength={10000}
              onChange={e => setAnswer(q, { written_answer: e.target.value })} placeholder="Type your answer…" aria-label="Your answer" />
          )}

          <div className="button-row">
            <button className="btn" onClick={() => setCurrent(c => c - 1)} disabled={current === 0}>← Previous</button>
            <span className="spacer" />
            <button className="btn" onClick={() => setCurrent(c => c + 1)} disabled={current === questions.length - 1}>Next →</button>
          </div>
        </section>
      </div>

      {confirmSubmit && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="card modal">
            <h2>Submit your exam?</h2>
            <p>
              {unanswered > 0
                ? <><strong>{unanswered} question{unanswered === 1 ? ' is' : 's are'} unanswered.</strong> </>
                : 'You have answered every question. '}
              You can't change your answers after submitting.
            </p>
            <ErrorText error={submitError} />
            <div className="button-row">
              <button className="btn btn-primary" onClick={submit}>Submit</button>
              <button className="btn" onClick={() => setConfirmSubmit(false)}>Keep working</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
