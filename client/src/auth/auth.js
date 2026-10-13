import { createContext, useContext } from 'react';

// Kept separate from AuthProvider.jsx so that file only exports a component (needed for Vite's hot reload)

export const AuthContext = createContext(null);

export const HOME_BY_ROLE = {
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student'
};

// { user, loading, login, logout }
export function useAuth() {
  return useContext(AuthContext);
}
