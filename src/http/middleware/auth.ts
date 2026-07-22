import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../../auth/jwt";

export type AuthedRequest = Request & {
  user?: {
    id: string;
    email: string;
  };
};

function authError(res: Response, code: string, message: string) {
  return res.status(401).json({
    error: {
      code,
      message,
      requestId: res.locals.requestId
    }
  });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return authError(res, "MISSING_BEARER_TOKEN", "Missing bearer token");
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return authError(res, "INVALID_BEARER_TOKEN", "Invalid bearer token");
  }
}
