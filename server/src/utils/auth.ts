import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export type JwtPayload = { sub: string; role: 'admin' | 'captain' | 'player' };

export function signAccessToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return jwt.verify(token, secret) as JwtPayload;
}

export function signRefreshToken(payload: { sub: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyRefreshToken(token: string): { sub: string; iat: number; exp: number } {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return jwt.verify(token, secret) as any;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashRefreshToken(rt: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(rt, salt);
}

export async function compareRefreshToken(rt: string, hash: string | undefined | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(rt, hash);
}


