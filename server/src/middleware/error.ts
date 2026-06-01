import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { logger } from "../utils/logger.js";

export function notFound(_req: Request, res: Response) {
  res.status(StatusCodes.NOT_FOUND).json({ error: "Route not found" });
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error({ err }, "Unhandled error");
  const status = err.status || StatusCodes.INTERNAL_SERVER_ERROR;
  res.status(status).json({ error: err.message || "Internal Server Error" });
}
