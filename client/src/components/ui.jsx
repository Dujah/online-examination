// Small shared display components

export function Message({ message }) {
  if (!message) return null;
  return <p className={`msg msg-${message.type}`}>{message.text}</p>;
}

export function ErrorText({ error }) {
  return error ? <p className="msg msg-error">{error}</p> : null;
}

const BADGE_TONE = {
  DRAFT: 'neutral', PUBLISHED: 'success',
  UPCOMING: 'info', ONGOING: 'warning', FINISHED: 'neutral', CANCELLED: 'danger',
  REGISTERED: 'neutral', IN_PROGRESS: 'warning', COMPLETED: 'success', ABSENT: 'danger',
  MCQ: 'info', THEORY: 'neutral'
};

// Coloured status pill: <Badge value="UPCOMING" />
export function Badge({ value, label }) {
  return <span className={`badge badge-${BADGE_TONE[value] || 'neutral'}`}>{label || value.replace('_', ' ').toLowerCase()}</span>;
}
