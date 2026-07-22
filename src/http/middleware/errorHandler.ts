import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../../logger/logger";
import { isHttpError } from "../errors/httpError";

function buildErrorResponse(
  code: string,
  message: string,
  requestId: string | undefined,
  details?: unknown
) {
  return {
    error: {
      code,
      message,
      requestId,
      ...(details ? { details } : {})
    }
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = res.locals.requestId as string | undefined;

  if (err instanceof ZodError) {
    return res.status(400).json(
      buildErrorResponse("VALIDATION_ERROR", "Validation failed", requestId, {
        issues: err.issues.map((issue) => ({
          path: issue.path,
          message: issue.message
        }))
      })
    );
  }

  if (isHttpError(err)) {
    return res
      .status(err.statusCode)
      .json(buildErrorResponse("HTTP_ERROR", err.message, requestId, err.details));
  }

  logger.error({ err, requestId, path: req.path, method: req.method }, "Unhandled API error");

  return res
    .status(500)
    .json(buildErrorResponse("INTERNAL_SERVER_ERROR", "Internal server error", requestId));
}
