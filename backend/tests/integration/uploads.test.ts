import request from 'supertest';
import { Pool } from 'pg';
import { createApp } from '../../src/app';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://loginsight:loginsight@localhost:5432/loginsight';

describe('upload routes', () => {
  let pool: Pool;
  const app = createApp();
  let token: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');

    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'uploader@example.com', password: 'correct-horse' });
    token = signupRes.body.token;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('uploads a log file and lists it back for the user', async () => {
    const uploadRes = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('line one\nline two\n'), 'test.log');

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.filename).toBe('test.log');
    expect(uploadRes.body.total_lines).toBe(2);

    const listRes = await request(app)
      .get('/api/uploads')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
  });

  it('rejects uploads without authentication', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('line one\n'), 'test.log');

    expect(res.status).toBe(401);
  });
});
