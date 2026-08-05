import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';

interface Summary {
  total: number;
  allowed: number;
  blocked: number;
  uniqueIps: number;
  uniqueUsers: number;
}

export function DashboardPage() {
  const { id } = useParams();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Summary>(`/uploads/${id}/summary`)
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load summary'));
  }, [id]);

  return (
    <div className="page">
      <p>
        <Link to="/">&larr; Back to uploads</Link>
      </p>
      <h1>Upload #{id}</h1>
      {error && <p className="form-error">{error}</p>}
      {summary && (
        <pre>{JSON.stringify(summary, null, 2)}</pre>
      )}
    </div>
  );
}
