import { useState } from 'react';
import { api } from '../../api';
import { useApiData } from '../../hooks/useApiData';
import { useAction } from '../../hooks/useAction';
import { Badge, ErrorText, Message } from '../../components/ui';
import { formatDate, hhmm, todayYmd } from '../../format';

const blank = { exam_date: '', start_time: '', end_time: '' };

// Schedules for a published exam: add, reschedule (upcoming only), cancel, delete.
export default function ExamSchedules({ exam, onChanged }) {
  const { data: schedules, loading, error, reload } = useApiData(`/schedules?exam_id=${exam.exam_id}`);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(blank);
  const { busy, message, run } = useAction();

  const done = () => { reload(); onChanged?.(); };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (await run(() => api.post('/schedules', { exam_id: exam.exam_id, ...form }), 'Schedule added.')) {
      setForm(blank);
      done();
    }
  };

  const startEdit = (s) => {
    setEditingId(s.schedule_id);
    setEditForm({ exam_date: s.exam_date, start_time: hhmm(s.start_time), end_time: hhmm(s.end_time) });
  };

  const handleSave = async (id) => {
    if (await run(() => api.put(`/schedules/${id}`, editForm), 'Schedule updated.')) {
      setEditingId(null);
      done();
    }
  };

  const handleCancel = async (s) => {
    if (!window.confirm(`Cancel the ${formatDate(s.exam_date)} sitting? Students will no longer see it.`)) return;
    if (await run(() => api.patch(`/schedules/${s.schedule_id}/cancel`), 'Schedule cancelled.')) done();
  };

  const handleDelete = async (s) => {
    if (!window.confirm('Delete this schedule?')) return;
    if (await run(() => api.delete(`/schedules/${s.schedule_id}`), 'Schedule deleted.')) done();
  };

  const timeFields = (values, setValues) => (
    <>
      <input type="date" min={todayYmd()} value={values.exam_date} onChange={e => setValues(v => ({ ...v, exam_date: e.target.value }))} required aria-label="Date" />
      <input type="time" value={values.start_time} onChange={e => setValues(v => ({ ...v, start_time: e.target.value }))} required aria-label="Start time" />
      <input type="time" value={values.end_time} onChange={e => setValues(v => ({ ...v, end_time: e.target.value }))} required aria-label="End time" />
    </>
  );

  return (
    <div className="card stack">
      <h2>Schedules</h2>
      <p className="muted small">
        Students can start any time inside the window and get {exam.duration_minutes} minutes, so the window must be at least that long.
        Sittings for the same semester can't overlap.
      </p>

      <form className="inline-form" onSubmit={handleAdd}>
        <label>Date<input type="date" min={todayYmd()} value={form.exam_date} onChange={e => setForm(f => ({ ...f, exam_date: e.target.value }))} required /></label>
        <label>Opens<input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required /></label>
        <label>Closes<input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} required /></label>
        <button className="btn btn-primary" disabled={busy}>Add schedule</button>
      </form>

      <Message message={message} />
      <ErrorText error={error} />

      {loading ? <p className="muted">Loading…</p> : schedules.length === 0 ? <p className="muted">Not scheduled yet.</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Window</th><th>Status</th><th className="actions-col"></th></tr></thead>
            <tbody>
              {schedules.map(s => editingId === s.schedule_id ? (
                <tr key={s.schedule_id}>
                  <td colSpan={3}><div className="inline-form">{timeFields(editForm, setEditForm)}</div></td>
                  <td className="actions-col">
                    <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => handleSave(s.schedule_id)}>Save</button>
                    <button className="btn btn-sm" disabled={busy} onClick={() => setEditingId(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={s.schedule_id}>
                  <td>{formatDate(s.exam_date)}</td>
                  <td>{hhmm(s.start_time)} – {hhmm(s.end_time)}</td>
                  <td><Badge value={s.status} /></td>
                  <td className="actions-col">
                    {s.status === 'UPCOMING' && <button className="btn btn-sm" disabled={busy} onClick={() => startEdit(s)}>Reschedule</button>}
                    {(s.status === 'UPCOMING' || s.status === 'ONGOING') && (
                      <button className="btn btn-sm btn-danger-outline" disabled={busy} onClick={() => handleCancel(s)}>Cancel sitting</button>
                    )}
                    {s.status !== 'ONGOING' && (
                      <button className="btn btn-sm btn-danger-outline" disabled={busy} onClick={() => handleDelete(s)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
