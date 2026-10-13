import { useEffect, useState } from 'react';
import { api } from '../api';
import { AuthContext } from './auth';

// Holds the logged-in user for the whole app.
// The JWT itself lives in an httpOnly cookie that JavaScript can't read, so on page load
// we ask the server who we are (/auth/me) instead of decoding a token.
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until /auth/me answers

  useEffect(() => {
    api.get('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    // api.js fires this when any request comes back 401 (e.g. the cookie expired)
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = async (email, password) => {
    await api.post('/auth/login', { email, password });
    const me = await api.get('/auth/me');
    setUser(me);
    return me;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
