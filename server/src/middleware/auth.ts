import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { verifyAccessToken } from "../utils/auth.js";
import prisma from "../utils/db.js";

export function requireAuth(
  req: Request & { user?: { id: string; role: string } },
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Missing token" });
  }

  const token = header.substring("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: "Invalid token" });
  }
}

export function requireRoles(roles: Array<"admin" | "captain" | "player">) {
  return (
    req: Request & {
      user?: { id: string; role: "admin" | "captain" | "player" };
    },
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user)
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role))
      return res.status(StatusCodes.FORBIDDEN).json({ error: "Forbidden" });
    next();
  };
}

export function requireSuperAdmin() {
  return async (
    req: Request & { user?: { id: string; role: string } },
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user)
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ error: "Unauthorized" });

    const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !superAdminEmails.includes(user.email.toLowerCase())) {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ error: "Only the platform owner can perform this action." });
    }

    next();
  };
}
