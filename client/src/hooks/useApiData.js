import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

// Loads data from a GET endpoint: const { data, loading, error, reload } = useApiData('/departments')
// Pass null as the url to skip loading (e.g. until a filter is chosen).
export function useApiData(url, initial = []) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      setData(await api.get(url));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}
