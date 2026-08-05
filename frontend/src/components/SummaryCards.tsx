export interface Summary {
  total: number;
  allowed: number;
  blocked: number;
  uniqueIps: number;
  uniqueUsers: number;
  startTs: string | null;
  endTs: string | null;
  topCategories: { category: string; count: number }[];
  topSrcIps: { srcIp: string; count: number }[];
  anomalyCount: number;
}

export function SummaryCards({ summary }: { summary: Summary }) {
  const cards = [
    { label: 'Total requests', value: summary.total },
    { label: 'Allowed', value: summary.allowed },
    { label: 'Blocked', value: summary.blocked },
    { label: 'Unique source IPs', value: summary.uniqueIps },
    { label: 'Unique users', value: summary.uniqueUsers },
    { label: 'Anomalies flagged', value: summary.anomalyCount, alert: summary.anomalyCount > 0 },
  ];

  return (
    <div className="summary-cards">
      {cards.map((c) => (
        <div className={`stat-tile${c.alert ? ' stat-tile-alert' : ''}`} key={c.label}>
          <div className="stat-value">{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
