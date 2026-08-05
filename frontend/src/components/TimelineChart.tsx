import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface TimelineBucket {
  bucket: string;
  allowed: number;
  blocked: number;
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
  });
}

export function TimelineChart({ data }: { data: TimelineBucket[] }) {
  if (data.length === 0) return <p>No timeline data.</p>;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="bucket"
          tickFormatter={formatHour}
          tick={{ fill: 'var(--text)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          labelFormatter={(v) => formatHour(String(v))}
        />
        <Legend />
        <Bar
          dataKey="allowed"
          name="Allowed"
          stackId="a"
          fill="var(--status-good)"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="blocked"
          name="Blocked"
          stackId="a"
          fill="var(--status-critical)"
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
