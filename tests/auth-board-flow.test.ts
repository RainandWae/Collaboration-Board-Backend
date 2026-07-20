import request from "supertest";

jest.mock("../src/queue/notifications.queue", () => ({
  notificationsQueue: {
    add: jest.fn()
  }
}));

import { createApp } from "../src/http/app";
import { addBoardMember, authHeader, createBoard, createCard, createList, registerUser } from "./helper/api";
import { disconnectTestDb, resetTestDb } from "./helper/db";

const app = createApp();

describe("auth and board flow", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await resetTestDb();
    await disconnectTestDb();
  });

  it("handles board collaboration permissions and stale card updates", async () => {
    const owner = await registerUser(app, "owner@example.com", "Owner");
    const viewer = await registerUser(app, "viewer@example.com", "Viewer");
    const board = await createBoard(app, owner.token, "Product Roadmap");
    const list = await createList(app, owner.token, board.id, "Todo");
    const card = await createCard(app, owner.token, list.id, "Write integration tests", "Protect the main API flow");

    await request(app)
      .get(`/boards/${board.id}`)
      .set(authHeader(viewer.token))
      .expect(403);

    await addBoardMember(app, owner.token, board.id, viewer.user.email, "VIEWER");

    await request(app)
      .get(`/boards/${board.id}`)
      .set(authHeader(viewer.token))
      .expect(200);

    await request(app)
      .post(`/lists/${list.id}/cards`)
      .set(authHeader(viewer.token))
      .send({
        title: "Viewer should not create this"
      })
      .expect(403);

    const updateResponse = await request(app)
      .patch(`/cards/${card.id}`)
      .set(authHeader(owner.token))
      .send({
        title: "Write useful integration tests",
        version: 1
      })
      .expect(200);

    expect(updateResponse.body.card.version).toBe(2);

    await request(app)
      .patch(`/cards/${card.id}`)
      .set(authHeader(owner.token))
      .send({
        title: "Stale title",
        version: 1
      })
      .expect(409);

    const searchResponse = await request(app)
      .get("/search/cards")
      .query({ q: "integration", limit: 10 })
      .set(authHeader(viewer.token))
      .expect(200);

    expect(searchResponse.body.cards).toHaveLength(1);
    expect(searchResponse.body.cards[0].id).toBe(card.id);
  });
});
