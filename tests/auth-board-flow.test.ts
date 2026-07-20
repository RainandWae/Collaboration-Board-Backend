import request from "supertest";

jest.mock("../src/queue/notifications.queue", () => ({
  notificationsQueue: {
    add: jest.fn()
  }
}));

import { createApp } from "../src/http/app";
import { disconnectTestDb, resetTestDb } from "./helper/db";

const app = createApp();

async function registerUser(email: string, name: string) {
  const response = await request(app)
    .post("/auth/register")
    .send({
      email,
      password: "password123",
      name
    })
    .expect(201);

  return response.body as {
    token: string;
    user: {
      id: string;
      email: string;
      name: string;
    };
  };
}

describe("auth and board flow", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await resetTestDb();
    await disconnectTestDb();
  });

  it("handles board collaboration permissions and stale card updates", async () => {
    const owner = await registerUser("owner@example.com", "Owner");
    const viewer = await registerUser("viewer@example.com", "Viewer");

    const boardResponse = await request(app)
      .post("/boards")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Product Roadmap" })
      .expect(201);

    const boardId = boardResponse.body.board.id;

    const listResponse = await request(app)
      .post(`/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Todo" })
      .expect(201);

    const listId = listResponse.body.list.id;

    const cardResponse = await request(app)
      .post(`/lists/${listId}/cards`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        title: "Write integration tests",
        description: "Protect the main API flow"
      })
      .expect(201);

    const cardId = cardResponse.body.card.id;

    await request(app)
      .get(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(403);

    await request(app)
      .post(`/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        email: viewer.user.email,
        role: "VIEWER"
      })
      .expect(201);

    await request(app)
      .get(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    await request(app)
      .post(`/lists/${listId}/cards`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({
        title: "Viewer should not create this"
      })
      .expect(403);

    const updateResponse = await request(app)
      .patch(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        title: "Write useful integration tests",
        version: 1
      })
      .expect(200);

    expect(updateResponse.body.card.version).toBe(2);

    await request(app)
      .patch(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        title: "Stale title",
        version: 1
      })
      .expect(409);

    const searchResponse = await request(app)
      .get("/search/cards")
      .query({ q: "integration", limit: 10 })
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    expect(searchResponse.body.cards).toHaveLength(1);
    expect(searchResponse.body.cards[0].id).toBe(cardId);
  });
});
