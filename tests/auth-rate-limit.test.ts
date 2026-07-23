import request from "supertest";

jest.mock("../src/queue/notifications.queue", () => ({
  notificationsQueue: {
    add: jest.fn()
  }
}));

const redisState = new Map<string, number>();

jest.mock("../src/queue/connection", () => ({
  redis: {
    incr: jest.fn(async (key: string) => {
      const nextValue = (redisState.get(key) ?? 0) + 1;
      redisState.set(key, nextValue);
      return nextValue;
    }),
    pexpire: jest.fn(async () => 1),
    pttl: jest.fn(async () => 15 * 60 * 1000),
    quit: jest.fn()
  }
}));

import { createApp } from "../src/http/app";
import { disconnectTestDb, resetTestDb } from "./helper/db";

const app = createApp();

describe("auth rate limiting", () => {
  beforeEach(async () => {
    redisState.clear();
    await resetTestDb();
  });

  afterAll(async () => {
    await resetTestDb();
    await disconnectTestDb();
  });

  it("rate limits repeated login attempts for the same email", async () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await request(app)
        .post("/auth/login")
        .send({
          email: "missing@example.com",
          password: "wrong-password"
        })
        .expect(401);
    }

    const response = await request(app)
      .post("/auth/login")
      .send({
        email: "missing@example.com",
        password: "wrong-password"
      })
      .expect(429);

    expect(response.headers["retry-after"]).toBeDefined();
    expect(response.body.error.code).toBe("HTTP_ERROR");
    expect(response.body.error.message).toBe("Too many requests");
    expect(response.body.error.details.retryAfterSeconds).toBe(900);
  });

  it("rate limits repeated register attempts for the same email", async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await request(app)
        .post("/auth/register")
        .send({
          email: "new-user@example.com",
          password: "password123",
          name: "New User"
        })
        .expect(attempt === 1 ? 201 : 409);
    }

    const response = await request(app)
      .post("/auth/register")
      .send({
        email: "new-user@example.com",
        password: "password123",
        name: "New User"
      })
      .expect(429);

    expect(response.headers["retry-after"]).toBeDefined();
    expect(response.body.error.message).toBe("Too many requests");
  });
});
