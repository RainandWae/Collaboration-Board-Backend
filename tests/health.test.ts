import request from "supertest";

jest.mock("../src/queue/notifications.queue", () => ({
  notificationsQueue: {
    add: jest.fn()
  }
}));

import { createApp } from "../src/http/app";

describe("health", () => {
  it("returns ok", async () => {
    await request(createApp()).get("/health").expect(200, { status: "ok" });
  });
});
