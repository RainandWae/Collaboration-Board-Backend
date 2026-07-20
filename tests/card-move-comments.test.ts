import request from "supertest";

const addMock = jest.fn();

jest.mock("../src/queue/notifications.queue", () => ({
  notificationsQueue: {
    add: addMock
  }
}));

import { createApp } from "../src/http/app";
import { addBoardMember, authHeader, createBoard, createCard, createList, registerUser } from "./helper/api";
import { disconnectTestDb, resetTestDb } from "./helper/db";

const app = createApp();

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
    const owner = await registerUser(app, "owner-move@example.com", "Owner");
    const editor = await registerUser(app, "editor-move@example.com", "Editor");
    const board = await createBoard(app, owner.token, "Sprint Board");
    await addBoardMember(app, owner.token, board.id, editor.user.email, "EDITOR");
    const todoList = await createList(app, owner.token, board.id, "Todo");
    const doneList = await createList(app, owner.token, board.id, "Done");
    const firstCard = await createCard(app, owner.token, todoList.id, "First card");
    const secondCard = await createCard(app, owner.token, todoList.id, "Second card");

    const moveResponse = await request(app)
      .patch(`/cards/${secondCard.id}/move`)
      .set(authHeader(owner.token))
      .send({
        targetListId: doneList.id,
        position: 0,
        version: 1
      })
      .expect(200);

    expect(moveResponse.body.card.listId).toBe(doneList.id);
    expect(moveResponse.body.card.position).toBe(0);
    expect(moveResponse.body.card.version).toBe(2);

    await request(app)
      .patch(`/cards/${secondCard.id}/move`)
      .set(authHeader(owner.token))
      .send({
        targetListId: todoList.id,
        position: 0,
        version: 1
      })
      .expect(409);

    const todoCardsResponse = await request(app)
      .get(`/lists/${todoList.id}/cards`)
      .set(authHeader(owner.token))
      .expect(200);

    expect(todoCardsResponse.body.cards).toHaveLength(1);
    expect(todoCardsResponse.body.cards[0].id).toBe(firstCard.id);
    expect(todoCardsResponse.body.cards[0].position).toBe(0);

    const commentResponse = await request(app)
      .post(`/cards/${secondCard.id}/comments`)
      .set(authHeader(owner.token))
      .send({
        body: `Please review this @${editor.user.email}`
      })
      .expect(201);

    expect(commentResponse.body.comment.body).toContain(editor.user.email);

    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith("mention", {
      boardId: board.id,
      cardId: secondCard.id,
      mentionedUserId: editor.user.id,
      authorId: owner.user.id
    });
  });
});
