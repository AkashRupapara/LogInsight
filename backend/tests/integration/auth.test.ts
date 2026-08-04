import request from 'supertest';
import { Pool } from 'pg';
import { createApp } from '../../src/app';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://loginsight:loginsight@localhost:5432/loginsight';

describe('auth routes', () => {
  let pool: Pool;
  const app = createApp();

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('signs up a new user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'analyst@example.com', password: 'correct-horse' });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: expect.any(Number), email: 'analyst@example.com' });
    expect(typeof res.body.token).toBe('string');
  });

  it('rejects signup with a duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'analyst@example.com', password: 'another-password' });

    expect(res.status).toBe(409);
  });

  it('normalizes email case so duplicates are still caught', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'Analyst@Example.com', password: 'another-password' });

    expect(res.status).toBe(409);
  });

  it('rejects signup with an invalid email or short password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'analyst@example.com', password: 'correct-horse' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('rejects login with the wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'analyst@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('rejects login for a nonexistent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });

    expect(res.status).toBe(401);
  });

  it('returns the current user from /me when authenticated', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'analyst@example.com', password: 'correct-horse' });

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('analyst@example.com');
  });

  it('rejects /me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
