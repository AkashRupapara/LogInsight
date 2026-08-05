import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

export interface LogEntry {
  id: number;
  ts: string;
  username: string | null;
  src_ip: string;
  domain: string | null;
  action: 'Allowed' | 'Blocked';
  url_category: string | null;
}

export interface Anomaly {
  id: number;
  log_entry_id: number;
  rule_type: string;
  description: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
}

type SortKey = 'time' | 'anomaly';
type SortDir = 'asc' | 'desc';

function ActionBadge({ action }: { action: 'Allowed' | 'Blocked' }) {
  const color = action === 'Allowed' ? 'var(--status-good)' : 'var(--status-critical)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {action}
    </span>
  );
}

function severityColor(severity: Anomaly['severity']): string {
  if (severity === 'high') return 'var(--status-critical)';
  if (severity === 'medium') return 'var(--status-warning)';
  return 'var(--text)';
}

function severityRank(severity: Anomaly['severity']): number {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function worstSeverity(anomalies: Anomaly[]): Anomaly['severity'] {
  if (anomalies.some((a) => a.severity === 'high')) return 'high';
  if (anomalies.some((a) => a.severity === 'medium')) return 'medium';
  return 'low';
}

function AnomalyBadge({ anomalies, expanded }: { anomalies: Anomaly[]; expanded: boolean }) {
  if (anomalies.length === 0) return <span className="anomaly-none">—</span>;
  const severity = worstSeverity(anomalies);
  return (
    <span className="anomaly-badge" style={{ color: severityColor(severity) }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: severityColor(severity),
          display: 'inline-block',
        }}
      />
      {anomalies.length} flagged {expanded ? '▲' : '▼'}
    </span>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="sortable-header" onClick={onClick}>
      {label} <span className="sort-indicator">{active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
    </th>
  );
}

export function LogTable({
  entries,
  anomaliesByEntry,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  entries: LogEntry[];
  anomaliesByEntry: Map<number, Anomaly[]>;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [anomalousOnly, setAnomalousOnly] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLTableRowElement>(null);

  const anomalousCount = anomaliesByEntry.size;

  // Infinite scroll: fetch the next page once the sentinel row at the bottom
  // of the (fixed-height, internally scrolling) table comes into view.
  useEffect(() => {
    if (!onLoadMore) return;
    const root = scrollContainerRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (observedEntries) => {
        if (observedEntries[0]?.isIntersecting && hasMore && !loadingMore) {
          onLoadMore();
        }
      },
      { root, rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadingMore]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Time defaults oldest-first; anomaly defaults worst-first.
      setSortDir(key === 'time' ? 'asc' : 'desc');
    }
  }

  const displayedEntries = useMemo(() => {
    const filtered = anomalousOnly
      ? entries.filter((e) => (anomaliesByEntry.get(e.id)?.length ?? 0) > 0)
      : entries;

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'time') {
        return new Date(a.ts).getTime() - new Date(b.ts).getTime();
      }
      const aAnoms = anomaliesByEntry.get(a.id) ?? [];
      const bAnoms = anomaliesByEntry.get(b.id) ?? [];
      const aRank = aAnoms.length ? Math.max(...aAnoms.map((x) => severityRank(x.severity))) : 0;
      const bRank = bAnoms.length ? Math.max(...bAnoms.map((x) => severityRank(x.severity))) : 0;
      if (aRank !== bRank) return aRank - bRank;
      return aAnoms.length - bAnoms.length;
    });

    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [entries, anomaliesByEntry, sortKey, sortDir, anomalousOnly]);

  return (
    <div>
      <div className="log-table-toolbar">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={anomalousOnly}
            onChange={(e) => setAnomalousOnly(e.target.checked)}
          />
          Show anomalies only ({anomalousCount})
        </label>
      </div>

      {displayedEntries.length === 0 ? (
        <p className="empty-state">
          {anomalousOnly ? 'No anomalous entries in this upload.' : 'No entries.'}
        </p>
      ) : (
        <div className="log-table-scroll" ref={scrollContainerRef}>
          <table className="log-table">
            <thead>
              <tr>
                <SortableHeader
                  label="Time"
                  active={sortKey === 'time'}
                  dir={sortDir}
                  onClick={() => toggleSort('time')}
                />
                <th>User</th>
                <th>Source IP</th>
                <th>Domain</th>
                <th>Action</th>
                <th>Category</th>
                <SortableHeader
                  label="Anomaly"
                  active={sortKey === 'anomaly'}
                  dir={sortDir}
                  onClick={() => toggleSort('anomaly')}
                />
              </tr>
            </thead>
            <tbody>
              {displayedEntries.map((e) => {
                const anomalies = anomaliesByEntry.get(e.id) ?? [];
                const isAnomalous = anomalies.length > 0;
                const isExpanded = expandedId === e.id;

                return (
                  <Fragment key={e.id}>
                    <tr
                      className={isAnomalous ? 'row-anomalous' : undefined}
                      onClick={isAnomalous ? () => setExpandedId(isExpanded ? null : e.id) : undefined}
                      style={isAnomalous ? { cursor: 'pointer' } : undefined}
                    >
                      <td>{new Date(e.ts).toLocaleString()}</td>
                      <td>{e.username ?? '—'}</td>
                      <td>{e.src_ip}</td>
                      <td>{e.domain ?? '—'}</td>
                      <td>
                        <ActionBadge action={e.action} />
                      </td>
                      <td>{e.url_category ?? '—'}</td>
                      <td>
                        <AnomalyBadge anomalies={anomalies} expanded={isExpanded} />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="row-anomaly-detail">
                        <td colSpan={7}>
                          <ul className="anomaly-detail-list">
                            {anomalies.map((a) => (
                              <li key={a.id}>
                                <span
                                  className="anomaly-detail-severity"
                                  style={{ color: severityColor(a.severity) }}
                                >
                                  {a.severity}
                                </span>
                                <span className="anomaly-detail-desc">{a.description}</span>
                                <span className="anomaly-detail-confidence">
                                  {Math.round(a.confidence * 100)}% confidence
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr ref={sentinelRef} className="scroll-sentinel">
                <td colSpan={7}>{loadingMore ? 'Loading more…' : hasMore ? '' : null}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
