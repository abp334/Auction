import type { CorsOptions } from "cors";

export function createCorsOptions(): CorsOptions {
  const originEnv = process.env.CLIENT_ORIGIN;
  const isProd = process.env.NODE_ENV === "production";

  const allowOrigins: string[] = [];

  if (!isProd) {
    allowOrigins.push(
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:8080",
      "http://127.0.0.1:8080"
    );
  }

  if (originEnv) {
    originEnv.split(",").forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) allowOrigins.push(trimmed);
    });
    // Auto-add www / non-www variant for each production origin
    if (isProd) {
      const extras: string[] = [];
      allowOrigins.forEach((origin) => {
        try {
          const url = new URL(origin);
          if (url.hostname.startsWith("www.")) {
            url.hostname = url.hostname.slice(4);
            extras.push(url.origin);
          } else {
            url.hostname = `www.${url.hostname}`;
            extras.push(url.origin);
          }
        } catch {
          // invalid URL, skip
        }
      });
      allowOrigins.push(...extras);
    }
  }

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, mobile apps, curl)
      if (!origin) return callback(null, true);
      if (allowOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}
