import { useState } from 'react';
import { api } from '../../api';
import { useAction } from '../../hooks/useAction';
import { Message } from '../../components/ui';

const blankOption = () => ({ option_text: '', is_correct: false });

// Create or edit one question. Pass `question` (with options, from GET /questions/:id) to edit.
export default function QuestionForm({ subjectId, question, onSaved, onCancel }) {
  const editing = Boolean(question);
  const [text, setText] = useState(question?.question_text ?? '');
  const [type, setType] = useState(question?.question_type ?? 'MCQ');
  const [marks, setMarks] = useState(question ? String(Number(question.marks)) : '1');
  const [options, setOptions] = useState(
    question?.options?.map(o => ({ option_text: o.option_text, is_correct: Boolean(o.is_correct) })) ?? [blankOption(), blankOption()]
  );
  const { busy, message, run, setMessage } = useAction();

  const setOption = (i, patch) => setOptions(opts => opts.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  // Exactly one option is correct, so picking one clears the others
  const markCorrect = (i) => setOptions(opts => opts.map((o, j) => ({ ...o, is_correct: j === i })));
  const removeOption = (i) => setOptions(opts => opts.filter((_, j) => j !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (type === 'MCQ' && !options.some(o => o.is_correct)) {
      setMessage({ type: 'error', text: 'Mark one option as the correct answer.' });
      return;
    }
    const body = { question_text: text.trim(), marks: Number(marks) };
    if (type === 'MCQ') body.options = options.map(o => ({ option_text: o.option_text.trim(), is_correct: o.is_correct }));

    const ok = await run(() => editing
      ? api.put(`/questions/${question.question_id}`, body)
      : api.post('/questions', { ...body, subject_id: Number(subjectId), question_type: type }));
    if (ok) onSaved(editing ? 'Question updated.' : 'Question added.');
  };

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h2>{editing ? 'Edit question' : 'New question'}</h2>
      <label>
        Question
        <textarea rows={3} value={text} onChange={e => setText(e.target.value)} required autoFocus />
      </label>
      <div className="inline-form">
        <label>
          Type
          {/* The type can't change after creation — the backend rejects it */}
          <select value={type} onChange={e => setType(e.target.value)} disabled={editing}>
            <option value="MCQ">Multiple choice</option>
            <option value="THEORY">Theory (written answer)</option>
          </select>
        </label>
        <label>
          Marks
          <input type="number" min="0.01" step="0.01" value={marks} onChange={e => setMarks(e.target.value)} required />
        </label>
      </div>

      {type === 'MCQ' && (
        <fieldset className="options-editor">
          <legend>Options — select the correct answer</legend>
          {options.map((o, i) => (
            <div key={i} className="option-row">
              <input type="radio" name="correct" checked={o.is_correct} onChange={() => markCorrect(i)} aria-label={`Option ${i + 1} is correct`} />
              <input value={o.option_text} onChange={e => setOption(i, { option_text: e.target.value })}
                placeholder={`Option ${i + 1}`} maxLength={255} required />
              <button type="button" className="btn btn-sm" onClick={() => removeOption(i)} disabled={options.length <= 2}
                title={options.length <= 2 ? 'An MCQ needs at least 2 options' : 'Remove option'}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setOptions(opts => [...opts, blankOption()])}>+ Add option</button>
        </fieldset>
      )}

      <Message message={message} />
      <div className="button-row">
        <button className="btn btn-primary" disabled={busy}>{editing ? 'Save changes' : 'Add question'}</button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
