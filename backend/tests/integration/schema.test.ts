import { Pool } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://loginsight:loginsight@localhost:5432/loginsight';

describe('database schema', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    // Integration tests run against a real (local/dev) Postgres instance -
    // start clean so assertions aren't affected by leftover rows from prior runs.
    await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('has the expected tables', async () => {
    const res = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const tables = res.rows.map((r) => r.table_name).sort();
    expect(tables).toEqual(['anomalies', 'log_entries', 'uploads', 'users']);
  });

  it('enforces unique user emails', async () => {
    await pool.query(`INSERT INTO users (email, password_hash) VALUES ($1, $2)`, [
      'analyst@example.com',
      'hash',
    ]);

    await expect(
      pool.query(`INSERT INTO users (email, password_hash) VALUES ($1, $2)`, [
        'analyst@example.com',
        'hash2',
      ])
    ).rejects.toThrow(/duplicate key/);
  });

  it('rejects uploads referencing a nonexistent user', async () => {
    await expect(
      pool.query(
        `INSERT INTO uploads (user_id, filename, file_path) VALUES ($1, $2, $3)`,
        [999999, 'test.log', '/app/uploads/test.log']
      )
    ).rejects.toThrow(/foreign key/);
  });

  it('cascades user deletion to uploads, log_entries, and anomalies', async () => {
    const userRes = await pool.query<{ id: number }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
      ['cascade@example.com', 'hash']
    );
    const userId = userRes.rows[0].id;

    const uploadRes = await pool.query<{ id: number }>(
      `INSERT INTO uploads (user_id, filename, file_path) VALUES ($1, $2, $3) RETURNING id`,
      [userId, 'test.log', '/app/uploads/test.log']
    );
    const uploadId = uploadRes.rows[0].id;

    const entryRes = await pool.query<{ id: number }>(
      `INSERT INTO log_entries (upload_id, ts, src_ip, action, raw_line)
       VALUES ($1, now(), '1.2.3.4', 'Allowed', 'raw') RETURNING id`,
      [uploadId]
    );
    const entryId = entryRes.rows[0].id;

    await pool.query(
      `INSERT INTO anomalies (log_entry_id, upload_id, rule_type, description, confidence, severity)
       VALUES ($1, $2, 'test_rule', 'test anomaly', 0.5, 'low')`,
      [entryId, uploadId]
    );

    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);

    const remaining = await pool.query(`SELECT id FROM uploads WHERE id = $1`, [uploadId]);
    expect(remaining.rows).toHaveLength(0);

    const remainingAnomalies = await pool.query(`SELECT id FROM anomalies WHERE upload_id = $1`, [
      uploadId,
    ]);
    expect(remainingAnomalies.rows).toHaveLength(0);
  });

  it('rejects anomaly confidence values outside [0, 1]', async () => {
    const userRes = await pool.query<{ id: number }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
      ['confidence@example.com', 'hash']
    );
    const uploadRes = await pool.query<{ id: number }>(
      `INSERT INTO uploads (user_id, filename, file_path) VALUES ($1, $2, $3) RETURNING id`,
      [userRes.rows[0].id, 'test.log', '/app/uploads/test.log']
    );
    const entryRes = await pool.query<{ id: number }>(
      `INSERT INTO log_entries (upload_id, ts, src_ip, action, raw_line)
       VALUES ($1, now(), '1.2.3.4', 'Allowed', 'raw') RETURNING id`,
      [uploadRes.rows[0].id]
    );

    await expect(
      pool.query(
        `INSERT INTO anomalies (log_entry_id, upload_id, rule_type, description, confidence, severity)
         VALUES ($1, $2, 'test_rule', 'test anomaly', 1.5, 'low')`,
        [entryRes.rows[0].id, uploadRes.rows[0].id]
      )
    ).rejects.toThrow(/violates check constraint/);
  });
});
