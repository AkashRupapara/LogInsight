import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AuthenticatedRequest, requireAuth } from '../src/middleware/auth';

const JWT_SECRET = 'test-secret';

function buildTestApp() {
  const app = express();
  app.get('/protected', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ userId: req.userId });
  });
  return app;
}

describe('requireAuth middleware', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('rejects requests with no Authorization header', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
  });

  it('rejects requests with a malformed Authorization header', async () => {
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', 'Basic somevalue');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid/expired token', async () => {
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('accepts a valid token and attaches userId to the request', async () => {
    const token = jwt.sign({ sub: 42 }, JWT_SECRET, { expiresIn: '1h' });
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 42 });
  });
});
