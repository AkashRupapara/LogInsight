import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import { SummaryCards, type Summary } from '../components/SummaryCards';
import { TimelineChart, type TimelineBucket } from '../components/TimelineChart';
import { LogTable, type LogEntry } from '../components/LogTable';

export function DashboardPage() {
  const { id } = useParams();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Summary>(`/uploads/${id}/summary`),
      apiFetch<TimelineBucket[]>(`/uploads/${id}/timeline`),
      apiFetch<LogEntry[]>(`/uploads/${id}/entries?limit=200`),
    ])
      .then(([s, t, e]) => {
        setSummary(s);
        setTimeline(t);
        setEntries(e);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load upload'));
  }, [id]);

  return (
    <div>
      <AppHeader />
      <div className="page">
        <Link to="/" className="breadcrumb">
          &larr; Back to uploads
        </Link>
        <h1>Upload #{id}</h1>
        {error && <p className="form-error">{error}</p>}

        {summary && <SummaryCards summary={summary} />}

        <h2>Timeline</h2>
        <TimelineChart data={timeline} />

        <h2>Log entries</h2>
        <div className="log-table-wrap">
          <LogTable entries={entries} />
        </div>
      </div>
    </div>
  );
}
