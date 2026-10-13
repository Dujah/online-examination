// Display formatting helpers

// '14:30:00' -> '14:30'
export const hhmm = (time) => (time ? time.slice(0, 5) : '');

// '2030-06-15' -> 'Sat, 15 Jun 2030' (parsed as a local date, not UTC midnight, so it never shifts a day)
export function formatDate(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// Decimal columns come back as strings like '2.50' — show '2.5'
export const num = (value) => Number(value ?? 0).toString();

// Today as 'YYYY-MM-DD' in local time (for <input type="date" min>)
export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
