import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isHttpError } from "../errors/httpError";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      issues: err.issues.map((issue) => ({
        path: issue.path,
        message: issue.message
      }))
    });
  }

  if (isHttpError(err)) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {})
    });
  }

  console.error(err);

  return res.status(500).json({
    error: "Internal server error"
  });
}
