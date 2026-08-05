import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { AppHeader } from '../components/AppHeader';
import { SummaryCards, type Summary } from '../components/SummaryCards';
import { TimelineChart, type TimelineBucket } from '../components/TimelineChart';
import { LogTable, type LogEntry, type Anomaly } from '../components/LogTable';

const PAGE_SIZE = 100;

interface EntriesPage {
  entries: LogEntry[];
  nextCursor: string | null;
}

export function DashboardPage() {
  const { id } = useParams();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Summary>(`/uploads/${id}/summary`),
      apiFetch<TimelineBucket[]>(`/uploads/${id}/timeline`),
      apiFetch<EntriesPage>(`/uploads/${id}/entries?limit=${PAGE_SIZE}`),
      apiFetch<Anomaly[]>(`/uploads/${id}/anomalies`),
    ])
      .then(([s, t, entriesPage, a]) => {
        setSummary(s);
        setTimeline(t);
        setEntries(entriesPage.entries);
        setNextCursor(entriesPage.nextCursor);
        setAnomalies(a);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load upload'));
  }, [id]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<EntriesPage>(
        `/uploads/${id}/entries?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(nextCursor)}`
      );
      setEntries((prev) => [...prev, ...page.entries]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load more entries');
    } finally {
      setLoadingMore(false);
    }
  }, [id, nextCursor, loadingMore]);

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
          <p className="section-hint section-hint-nowrap">
            Rows highlighted in red were flagged by the anomaly engine — click one to see why and how confident the detector is.
          </p>
        )}
        <LogTable
          entries={entries}
          anomaliesByEntry={anomaliesByEntry}
          hasMore={nextCursor !== null}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      </div>
    </div>
  );
}
