import type { CorsOptions } from "cors";

export function createCorsOptions(): CorsOptions {
  const originEnv = process.env.CLIENT_ORIGIN;

  // If a CLIENT_ORIGIN is explicitly provided, restrict to that plus common localhost dev origins.
  // Otherwise allow dynamic origins (reflect the request origin) to support hosted deployments
  // where the client and server share the same origin.
  const allowOrigins = originEnv
    ? [
        originEnv,
        "https://clashbid.live",
        "https://auction-ten-sage.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
      ].filter(Boolean)
    : true;

  return {
    origin: allowOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}
