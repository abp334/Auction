import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export function notFound(_req: Request, res: Response) {
  res.status(StatusCodes.NOT_FOUND).json({ error: 'Route not found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.status || StatusCodes.INTERNAL_SERVER_ERROR;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
}


