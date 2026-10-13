import { useCallback, useState } from 'react';

// Runs a save/delete-style action with a busy flag and a success/error message.
//   const { busy, message, run, setMessage } = useAction();
//   const ok = await run(() => api.post(...), 'Saved.');
// Returns true if the action succeeded.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }

  const run = useCallback(async (action, successText) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (successText) setMessage({ type: 'success', text: successText });
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, message, run, setMessage };
}
