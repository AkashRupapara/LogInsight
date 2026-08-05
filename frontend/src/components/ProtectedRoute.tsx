import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth();

  if (loading) return <p>Loading…</p>;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
