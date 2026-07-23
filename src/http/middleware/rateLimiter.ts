import type { NextFunction, Request, RequestHandler, Response } from "express";
import { redis } from "../../queue/connection";
import { HttpError } from "../errors/httpError";

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
};

function normalizeRateLimitKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._@-]/g, "_");
}

function getClientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function createRedisRateLimiter(options: RateLimitOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const rawKey = options.keyGenerator?.(req) ?? getClientIp(req);
      const key = `rate-limit:${options.keyPrefix}:${normalizeRateLimitKey(rawKey)}`;

      const requestCount = await redis.incr(key);

      if (requestCount === 1) {
        await redis.pexpire(key, options.windowMs);
      }

      const ttlMs = await redis.pttl(key);
      const retryAfterSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

      res.setHeader("RateLimit-Limit", options.maxRequests.toString());
      res.setHeader(
        "RateLimit-Remaining",
        Math.max(0, options.maxRequests - requestCount).toString()
      );
      res.setHeader("RateLimit-Reset", retryAfterSeconds.toString());

      if (requestCount > options.maxRequests) {
        res.setHeader("Retry-After", retryAfterSeconds.toString());

        throw new HttpError(429, "Too many requests", {
          retryAfterSeconds
        });
      }

      next();
    })().catch(next);
  };
}

export const registerRateLimiter = createRedisRateLimiter({
  keyPrefix: "auth-register",
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "unknown";
    return `${getClientIp(req)}:${email}`;
  }
});

export const loginRateLimiter = createRedisRateLimiter({
  keyPrefix: "auth-login",
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "unknown";
    return `${getClientIp(req)}:${email}`;
  }
});
