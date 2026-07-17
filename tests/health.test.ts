import request from "supertest";
import { createApp } from "../src/http/app";

describe("health", () => {
  it("returns ok", async () => {
    await request(createApp()).get("/health").expect(200, { status: "ok" });
  });
});
