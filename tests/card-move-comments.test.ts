import request from "supertest";

const addMock = jest.fn();

jest.mock("../src/queue/notifications.queue", () => ({
  notificationsQueue: {
    add: addMock
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

describe("card moves and comments", () => {
  beforeEach(async () => {
    addMock.mockClear();
    await resetTestDb();
  });

  afterAll(async () => {
    await resetTestDb();
    await disconnectTestDb();
  });

  it("moves cards transactionally and queues mention notifications", async () => {
    const owner = await registerUser("owner-move@example.com", "Owner");
    const editor = await registerUser("editor-move@example.com", "Editor");

    const boardResponse = await request(app)
      .post("/boards")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Sprint Board" })
      .expect(201);

    const boardId = boardResponse.body.board.id;

    await request(app)
      .post(`/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        email: editor.user.email,
        role: "EDITOR"
      })
      .expect(201);

    const todoResponse = await request(app)
      .post(`/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Todo" })
      .expect(201);

    const doneResponse = await request(app)
      .post(`/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Done" })
      .expect(201);

    const todoListId = todoResponse.body.list.id;
    const doneListId = doneResponse.body.list.id;

    const firstCardResponse = await request(app)
      .post(`/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        title: "First card"
      })
      .expect(201);

    const secondCardResponse = await request(app)
      .post(`/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        title: "Second card"
      })
      .expect(201);

    const firstCardId = firstCardResponse.body.card.id;
    const secondCardId = secondCardResponse.body.card.id;

    const moveResponse = await request(app)
      .patch(`/cards/${secondCardId}/move`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        targetListId: doneListId,
        position: 0,
        version: 1
      })
      .expect(200);

    expect(moveResponse.body.card.listId).toBe(doneListId);
    expect(moveResponse.body.card.position).toBe(0);
    expect(moveResponse.body.card.version).toBe(2);

    await request(app)
      .patch(`/cards/${secondCardId}/move`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        targetListId: todoListId,
        position: 0,
        version: 1
      })
      .expect(409);

    const todoCardsResponse = await request(app)
      .get(`/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);

    expect(todoCardsResponse.body.cards).toHaveLength(1);
    expect(todoCardsResponse.body.cards[0].id).toBe(firstCardId);
    expect(todoCardsResponse.body.cards[0].position).toBe(0);

    const commentResponse = await request(app)
      .post(`/cards/${secondCardId}/comments`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        body: `Please review this @${editor.user.email}`
      })
      .expect(201);

    expect(commentResponse.body.comment.body).toContain(editor.user.email);

    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith("mention", {
      boardId,
      cardId: secondCardId,
      mentionedUserId: editor.user.id,
      authorId: owner.user.id
    });
  });
});