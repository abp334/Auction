import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export type JwtPayload = { sub: string; role: "admin" | "captain" | "player" };

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET or JWT_SECRET not set");
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET or JWT_SECRET not set");
  return secret;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: "15m" });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, getAccessSecret()) as JwtPayload;
}

export function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: "7d" });
}

export function verifyRefreshToken(
  token: string
): { sub: string; iat: number; exp: number } {
  return jwt.verify(token, getRefreshSecret()) as any;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashRefreshToken(rt: string): Promise<string> {
  return bcrypt.hash(rt, 10);
}

export async function compareRefreshToken(
  rt: string,
  hash: string | undefined | null
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(rt, hash);
}
