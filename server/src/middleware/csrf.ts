import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

/**
 * CSRF protection for cookie-reliant endpoints.
 *
 * Validates that state-changing requests (POST, PUT, DELETE, PATCH) carry an
 * Origin or Referer header matching one of the allowed origins. This prevents
 * cross-site form submissions from exploiting the httpOnly refresh cookie.
 *
 * Safe methods (GET, HEAD, OPTIONS) are skipped since they should not
 * mutate state.
 */
export function csrfProtection() {
  const originEnv = process.env.CLIENT_ORIGIN || "";
  const isProd = process.env.NODE_ENV === "production";

  const allowedOrigins = new Set<string>();

  if (!isProd) {
    allowedOrigins.add("http://localhost:5173");
    allowedOrigins.add("http://127.0.0.1:5173");
    allowedOrigins.add("http://localhost:8080");
    allowedOrigins.add("http://127.0.0.1:8080");
  }

  originEnv.split(",").forEach((o) => {
    const trimmed = o.trim();
    if (trimmed) {
      allowedOrigins.add(trimmed);
      try {
        const url = new URL(trimmed);
        if (url.hostname.startsWith("www.")) {
          url.hostname = url.hostname.slice(4);
          allowedOrigins.add(url.origin);
        } else {
          url.hostname = `www.${url.hostname}`;
          allowedOrigins.add(url.origin);
        }
      } catch {
        // skip invalid
      }
    }
  });

  return (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return next();

    // If request carries no cookies, CSRF is not a concern (pure JWT flow)
    if (!req.cookies?.rt) return next();

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    if (origin && allowedOrigins.has(origin)) return next();
    if (referer) {
      try {
        const refOrigin = new URL(referer).origin;
        if (allowedOrigins.has(refOrigin)) return next();
      } catch {
        // invalid referer
      }
    }

    // In development, allow if no origin (e.g. Postman, curl)
    if (!isProd && !origin && !referer) return next();

    return res.status(StatusCodes.FORBIDDEN).json({
      error: "Request blocked: invalid origin (CSRF protection).",
    });
  };
}
