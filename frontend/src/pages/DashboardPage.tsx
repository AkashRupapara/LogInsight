import { useEffect, useMemo, useState } from 'react';
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
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Sort and the "anomalies only" filter run client-side over `entries`, so they
  // must operate on the whole file, not just the first page. We render the first
  // page immediately for a fast first paint, then keep fetching pages in the
  // background (independent of scroll position) until nextCursor is null.
  useEffect(() => {
    let cancelled = false;
    setLoadingEntries(true);

    async function loadAllEntries() {
      let cursor: string | undefined;
      let all: LogEntry[] = [];
      do {
        const page = await apiFetch<EntriesPage>(
          `/uploads/${id}/entries?limit=${PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
        );
        if (cancelled) return;
        all = all.concat(page.entries);
        setEntries(all);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      if (!cancelled) setLoadingEntries(false);
    }

    Promise.all([
      apiFetch<Summary>(`/uploads/${id}/summary`),
      apiFetch<TimelineBucket[]>(`/uploads/${id}/timeline`),
      apiFetch<Anomaly[]>(`/uploads/${id}/anomalies`),
    ])
      .then(([s, t, a]) => {
        if (cancelled) return;
        setSummary(s);
        setTimeline(t);
        setAnomalies(a);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load upload');
      });

    loadAllEntries().catch((err) => {
      if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load log entries');
    });

    return () => {
      cancelled = true;
    };
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
          <p className="section-hint section-hint-nowrap">
            Rows highlighted in red were flagged by the anomaly engine — click one to see why and how confident the detector is.
          </p>
        )}
        <LogTable entries={entries} anomaliesByEntry={anomaliesByEntry} loading={loadingEntries} />
      </div>
    </div>
  );
}
