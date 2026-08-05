import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import { SummaryCards, type Summary } from '../components/SummaryCards';
import { TimelineChart, type TimelineBucket } from '../components/TimelineChart';
import { LogTable, type LogEntry, type Anomaly } from '../components/LogTable';

export function DashboardPage() {
  const { id } = useParams();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Summary>(`/uploads/${id}/summary`),
      apiFetch<TimelineBucket[]>(`/uploads/${id}/timeline`),
      apiFetch<LogEntry[]>(`/uploads/${id}/entries?limit=200`),
      apiFetch<Anomaly[]>(`/uploads/${id}/anomalies`),
    ])
      .then(([s, t, e, a]) => {
        setSummary(s);
        setTimeline(t);
        setEntries(e);
        setAnomalies(a);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load upload'));
  }, [id]);

  const anomaliesByEntry = useMemo(() => {
    const map = new Map<number, Anomaly[]>();
    for (const a of anomalies) {
      const list = map.get(a.log_entry_id) ?? [];
      list.push(a);
      map.set(a.log_entry_id, list);
    }
    return map;
  }, [anomalies]);

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
        {anomalies.length > 0 && (
          <p className="section-hint">
            Rows highlighted in red were flagged by the anomaly engine — click one to see why and
            how confident the detector is.
          </p>
        )}
        <div className="log-table-wrap">
          <LogTable entries={entries} anomaliesByEntry={anomaliesByEntry} />
        </div>
      </div>
    </div>
  );
}
