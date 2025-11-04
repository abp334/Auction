import type { CorsOptions } from 'cors';

export function createCorsOptions(): CorsOptions {
  const originEnv = process.env.CLIENT_ORIGIN;
  const allowOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    originEnv || '',
  ].filter(Boolean);

  return {
    origin: allowOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}


