import type { CorsOptions } from "cors";

export function createCorsOptions(): CorsOptions {
  const originEnv = process.env.CLIENT_ORIGIN;

  const allowOrigins: string[] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ];

  if (originEnv) {
    allowOrigins.push(originEnv);
    // Auto-add www / non-www variant
    try {
      const url = new URL(originEnv);
      if (url.hostname.startsWith("www.")) {
        url.hostname = url.hostname.slice(4);
        allowOrigins.push(url.origin);
      } else {
        url.hostname = `www.${url.hostname}`;
        allowOrigins.push(url.origin);
      }
    } catch {
      // invalid URL, skip
    }
  }

  return {
    origin: allowOrigins.length > 0 ? allowOrigins : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}
