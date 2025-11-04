import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { verifyAccessToken } from "../utils/auth.js";

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
