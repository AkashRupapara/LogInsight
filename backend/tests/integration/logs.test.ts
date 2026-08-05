import request from 'supertest';
import { Pool } from 'pg';
import { createApp } from '../../src/app';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://loginsight:loginsight@localhost:5432/loginsight';

const SAMPLE_LOG = [
  '2026-08-04T09:00:00Z,jsmith,Engineering,10.0.1.15,93.184.216.34,https://example.com/a,GET,Allowed,,General,,,512,4096,200,Mozilla/5.0',
  '2026-08-04T09:05:00Z,jsmith,Engineering,10.0.1.15,93.184.216.34,https://malicious.example/x,GET,Blocked,Malware,Malware Sites,Trojan,Trojan.Generic,256,0,403,Mozilla/5.0',
].join('\n');

describe('log analytics routes', () => {
  let pool: Pool;
  const app = createApp();
  let token: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');

    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'analyst2@example.com', password: 'correct-horse' });
    token = signupRes.body.token;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('ingests a log file and serves summary/timeline/entries for it', async () => {
    const uploadRes = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(SAMPLE_LOG), 'sample.log');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.status).toBe('complete');
    expect(uploadRes.body.parsed_lines).toBe(2);

    const uploadId = uploadRes.body.id;

    const summaryRes = await request(app)
      .get(`/api/uploads/${uploadId}/summary`)
      .set('Authorization', `Bearer ${token}`);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.total).toBe(2);
    expect(summaryRes.body.allowed).toBe(1);
    expect(summaryRes.body.blocked).toBe(1);

    const entriesRes = await request(app)
      .get(`/api/uploads/${uploadId}/entries`)
      .set('Authorization', `Bearer ${token}`);
    expect(entriesRes.status).toBe(200);
    expect(entriesRes.body).toHaveLength(2);

    expect(summaryRes.body.anomalyCount).toBeGreaterThan(0);

    const anomaliesRes = await request(app)
      .get(`/api/uploads/${uploadId}/anomalies`)
      .set('Authorization', `Bearer ${token}`);
    expect(anomaliesRes.status).toBe(200);
    expect(anomaliesRes.body.length).toBeGreaterThan(0);
    expect(anomaliesRes.body[0]).toHaveProperty('confidence');
    expect(anomaliesRes.body[0]).toHaveProperty('description');
  });
});
