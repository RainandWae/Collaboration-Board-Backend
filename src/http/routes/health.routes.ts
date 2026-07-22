import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

healthRouter.get("/live", (_req, res) => {
  res.json({
    status: "ok",
    checks: {
      api: "ok"
    }
  });
});

healthRouter.get("/ready", async (_req, res) => {
  const [{ prisma }, { redis }] = await Promise.all([
    import("../../db/prisma"),
    import("../../queue/connection")
  ]);

  const checks = {
    postgres: "ok",
    redis: "ok"
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    checks.postgres = "error";
  }

  try {
    await redis.ping();
  } catch {
    checks.redis = "error";
  }

  const isReady = checks.postgres === "ok" && checks.redis === "ok";

  return res.status(isReady ? 200 : 503).json({
    status: isReady ? "ok" : "error",
    checks
  });
});
