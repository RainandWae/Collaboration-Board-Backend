import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incomingRequestId = req.header("x-request-id");
  const requestId = incomingRequestId?.trim() || randomUUID();

  req.headers["x-request-id"] = requestId;
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  next();
}
