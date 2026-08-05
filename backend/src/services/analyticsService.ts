import { getPool } from '../db/pool';

export interface UploadSummary {
  total: number;
  allowed: number;
  blocked: number;
  uniqueIps: number;
  uniqueUsers: number;
  startTs: string | null;
  endTs: string | null;
  topCategories: { category: string; count: number }[];
  topSrcIps: { srcIp: string; count: number }[];
}

export async function getSummary(uploadId: number): Promise<UploadSummary> {
  const pool = getPool();

  const totalsRes = await pool.query(
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (WHERE action = 'Allowed')::int AS allowed,
       count(*) FILTER (WHERE action = 'Blocked')::int AS blocked,
       count(DISTINCT src_ip)::int AS unique_ips,
       count(DISTINCT username)::int AS unique_users,
       min(ts) AS start_ts,
       max(ts) AS end_ts
     FROM log_entries WHERE upload_id = $1`,
    [uploadId]
  );

  const categoriesRes = await pool.query(
    `SELECT url_category AS category, count(*)::int AS count
     FROM log_entries
     WHERE upload_id = $1 AND url_category IS NOT NULL
     GROUP BY url_category ORDER BY count DESC LIMIT 5`,
    [uploadId]
  );

  const srcIpsRes = await pool.query(
    `SELECT src_ip, count(*)::int AS count
     FROM log_entries WHERE upload_id = $1
     GROUP BY src_ip ORDER BY count DESC LIMIT 5`,
    [uploadId]
  );

  const row = totalsRes.rows[0];
  return {
    total: row.total,
    allowed: row.allowed,
    blocked: row.blocked,
    uniqueIps: row.unique_ips,
    uniqueUsers: row.unique_users,
    startTs: row.start_ts,
    endTs: row.end_ts,
    topCategories: categoriesRes.rows.map((r) => ({ category: r.category, count: r.count })),
    topSrcIps: srcIpsRes.rows.map((r) => ({ srcIp: r.src_ip, count: r.count })),
  };
}

export interface TimelineBucket {
  bucket: string;
  allowed: number;
  blocked: number;
}

export async function getTimeline(uploadId: number): Promise<TimelineBucket[]> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT
       date_trunc('hour', ts) AS bucket,
       count(*) FILTER (WHERE action = 'Allowed')::int AS allowed,
       count(*) FILTER (WHERE action = 'Blocked')::int AS blocked
     FROM log_entries
     WHERE upload_id = $1
     GROUP BY bucket ORDER BY bucket`,
    [uploadId]
  );
  return res.rows.map((r) => ({ bucket: r.bucket, allowed: r.allowed, blocked: r.blocked }));
}

export async function getEntries(uploadId: number, limit: number, offset: number) {
  const pool = getPool();
  const res = await pool.query(
    `SELECT * FROM log_entries WHERE upload_id = $1 ORDER BY ts LIMIT $2 OFFSET $3`,
    [uploadId, limit, offset]
  );
  return res.rows;
}
