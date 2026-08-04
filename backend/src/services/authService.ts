import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPool } from '../db/pool';

const SALT_ROUNDS = 12;
const TOKEN_TTL = '7d';

export interface AuthUser {
  id: number;
  email: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export class EmailAlreadyRegisteredError extends Error {}
export class InvalidCredentialsError extends Error {}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

export async function signup(email: string, password: string): Promise<AuthResult> {
  const pool = getPool();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const result = await pool.query<AuthUser>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
      [email, passwordHash]
    );
    const user = result.rows[0];
    return { user, token: signToken(user.id) };
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new EmailAlreadyRegisteredError('Email already registered');
    }
    throw err;
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const pool = getPool();
  const result = await pool.query<AuthUser & { password_hash: string }>(
    `SELECT id, email, password_hash FROM users WHERE email = $1`,
    [email]
  );
  const row = result.rows[0];
  if (!row) {
    throw new InvalidCredentialsError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    throw new InvalidCredentialsError('Invalid email or password');
  }

  return { user: { id: row.id, email: row.email }, token: signToken(row.id) };
}

export async function findUserById(id: number): Promise<AuthUser | undefined> {
  const pool = getPool();
  const result = await pool.query<AuthUser>(`SELECT id, email FROM users WHERE id = $1`, [id]);
  return result.rows[0];
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}
