import { Fragment, useState } from 'react';

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

export function LogTable({
  entries,
  anomaliesByEntry,
}: {
  entries: LogEntry[];
  anomaliesByEntry: Map<number, Anomaly[]>;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (entries.length === 0) return <p>No entries.</p>;

  return (
    <table className="log-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>User</th>
          <th>Source IP</th>
          <th>Domain</th>
          <th>Action</th>
          <th>Category</th>
          <th>Anomaly</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => {
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
      </tbody>
    </table>
  );
}
