import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  findUserById,
  login,
  signup,
} from '../services/authService';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

// Auth endpoints are the most attractive brute-force target in the app,
// so they get a tighter rate limit than the rest of the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const credentialsSchema = z.object({
  email: z.string().email(),
  // bcrypt silently truncates input beyond 72 bytes; reject longer passwords
  // up front rather than accepting a password that's effectively cut short.
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});

export const authRouter = Router();

authRouter.post(
  '/signup',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();

    try {
      const { user, token } = await signup(email, parsed.data.password);
      res.status(201).json({ user, token });
    } catch (err) {
      if (err instanceof EmailAlreadyRegisteredError) {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid email or password' });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();

    try {
      const { user, token } = await login(email, parsed.data.password);
      res.json({ user, token });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        res.status(401).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await findUserById(req.userId!);
    if (!user) {
      res.status(401).json({ error: 'User no longer exists' });
      return;
    }
    res.json({ user });
  })
);
