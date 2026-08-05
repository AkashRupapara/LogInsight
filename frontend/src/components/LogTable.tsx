export interface LogEntry {
  id: number;
  ts: string;
  username: string | null;
  src_ip: string;
  domain: string | null;
  action: 'Allowed' | 'Blocked';
  url_category: string | null;
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

export function LogTable({ entries }: { entries: LogEntry[] }) {
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
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id}>
            <td>{new Date(e.ts).toLocaleString()}</td>
            <td>{e.username ?? '—'}</td>
            <td>{e.src_ip}</td>
            <td>{e.domain ?? '—'}</td>
            <td>
              <ActionBadge action={e.action} />
            </td>
            <td>{e.url_category ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
