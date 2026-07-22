import request from "supertest";

jest.mock("../src/queue/notifications.queue", () => ({
  notificationsQueue: {
    add: jest.fn()
  }
}));

jest.mock("../src/db/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn()
  }
}));

jest.mock("../src/queue/connection", () => ({
  redis: {
    ping: jest.fn()
  }
}));

import { prisma } from "../src/db/prisma";
import { createApp } from "../src/http/app";
import { redis } from "../src/queue/connection";

const prismaMock = prisma as unknown as {
  $queryRaw: jest.Mock;
};

const redisMock = redis as unknown as {
  ping: jest.Mock;
};

describe("health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    redisMock.ping.mockResolvedValue("PONG");
  });

  it("keeps the legacy health endpoint", async () => {
    await request(createApp()).get("/health").expect(200, { status: "ok" });
  });

  it("returns live status without dependency checks", async () => {
    await request(createApp())
      .get("/health/live")
      .expect(200, {
        status: "ok",
        checks: {
          api: "ok"
        }
      });

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(redisMock.ping).not.toHaveBeenCalled();
  });

  it("returns ready status when dependencies are available", async () => {
    await request(createApp())
      .get("/health/ready")
      .expect(200, {
        status: "ok",
        checks: {
          postgres: "ok",
          redis: "ok"
        }
      });

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(redisMock.ping).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when Postgres is unavailable", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error("db down"));

    await request(createApp())
      .get("/health/ready")
      .expect(503, {
        status: "error",
        checks: {
          postgres: "error",
          redis: "ok"
        }
      });
  });

  it("returns 503 when Redis is unavailable", async () => {
    redisMock.ping.mockRejectedValueOnce(new Error("redis down"));

    await request(createApp())
      .get("/health/ready")
      .expect(503, {
        status: "error",
        checks: {
          postgres: "ok",
          redis: "error"
        }
      });
  });
});
