import { useState } from 'react';
import { api } from '../api';
import { useApiData } from '../hooks/useApiData';

// A list + add form + inline edit + delete for simple records, driven by a field config.
//
// fields: [{ name, label, type: 'text' | 'number' | 'select', options?: [{ value, label }], min?, max? }]
//   The first field is used for sorting.
//
// Example:
//   <CrudTable title="Courses" endpoint="/courses" idKey="course_id" noun="course"
//     fields={[{ name: 'course_name', label: 'Name', type: 'text' },
//              { name: 'department_id', label: 'Department', type: 'select', options: departmentOptions }]} />
export default function CrudTable({ endpoint, idKey, noun, fields, onChange }) {
  const { data: rows, loading, error: loadError, reload } = useApiData(endpoint);
  const blank = Object.fromEntries(fields.map(f => [f.name, '']));
  const [newRow, setNewRow] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState(blank);
  const [message, setMessage] = useState(null); // { type: 'error' | 'success', text }
  const [busy, setBusy] = useState(false);

  // Turn form strings into what the API expects (numbers for number/select fields)
  const toPayload = (row) => Object.fromEntries(fields.map(f => [
    f.name, f.type === 'text' ? row[f.name].trim() : Number(row[f.name])
  ]));

  const run = async (action, successText) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ type: 'success', text: successText });
      await reload();
      onChange?.();
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (await run(() => api.post(endpoint, toPayload(newRow)), `Added ${noun}.`)) setNewRow(blank);
  };

  const handleSave = async (id) => {
    if (await run(() => api.put(`${endpoint}/${id}`, toPayload(editRow)), `Saved ${noun}.`)) setEditingId(null);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete this ${noun}? This cannot be undone.`)) return;
    await run(() => api.delete(`${endpoint}/${row[idKey]}`), `Deleted ${noun}.`);
  };

  const startEdit = (row) => {
    setEditingId(row[idKey]);
    setEditRow(Object.fromEntries(fields.map(f => [f.name, String(row[f.name] ?? '')])));
    setMessage(null);
  };

  const display = (field, row) => {
    if (field.type === 'select') {
      return field.options.find(o => String(o.value) === String(row[field.name]))?.label ?? '—';
    }
    return field.format ? field.format(row[field.name]) : row[field.name];
  };

  const input = (field, value, onValue) => {
    if (field.type === 'select') {
      return (
        <select value={value} onChange={e => onValue(e.target.value)} required aria-label={field.label}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    return (
      <input type={field.type} value={value} onChange={e => onValue(e.target.value)} required
        min={field.min} max={field.max} placeholder={field.label} aria-label={field.label} />
    );
  };

  const sorted = [...rows].sort((a, b) =>
    String(display(fields[0], a)).localeCompare(String(display(fields[0], b)), undefined, { numeric: true }));

  return (
    <div className="stack">
      <form className="card inline-form" onSubmit={handleAdd}>
        {fields.map(f => (
          <label key={f.name}>
            {f.label}
            {input(f, newRow[f.name], v => setNewRow(r => ({ ...r, [f.name]: v })))}
          </label>
        ))}
        <button className="btn btn-primary" disabled={busy}>Add {noun}</button>
      </form>

      {message && <p className={`msg msg-${message.type}`}>{message.text}</p>}
      {loadError && <p className="msg msg-error">{loadError}</p>}

      <div className="card table-wrap">
        {loading ? <p className="muted">Loading…</p> : sorted.length === 0 ? <p className="muted">No {noun}s yet.</p> : (
          <table>
            <thead>
              <tr>
                {fields.map(f => <th key={f.name}>{f.label}</th>)}
                <th className="actions-col"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => {
                const id = row[idKey];
                const editing = editingId === id;
                return (
                  <tr key={id}>
                    {fields.map(f => (
                      <td key={f.name}>
                        {editing ? input(f, editRow[f.name], v => setEditRow(r => ({ ...r, [f.name]: v }))) : display(f, row)}
                      </td>
                    ))}
                    <td className="actions-col">
                      {editing ? (
                        <>
                          <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => handleSave(id)}>Save</button>
                          <button className="btn btn-sm" disabled={busy} onClick={() => setEditingId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-sm" disabled={busy} onClick={() => startEdit(row)}>Edit</button>
                          <button className="btn btn-sm btn-danger-outline" disabled={busy} onClick={() => handleDelete(row)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
