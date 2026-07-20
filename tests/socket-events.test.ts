import http from "http";
import request from "supertest";
import { io as createClient, type Socket } from "socket.io-client";

jest.mock("../src/queue/notifications.queue", () => ({
  notificationsQueue: {
    add: jest.fn()
  }
}));

import { createApp } from "../src/http/app";
import { createSocketServer } from "../src/realtime/socket";
import { disconnectTestDb, resetTestDb } from "./helper/db";

type RegisteredUser = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
};

async function registerUser(appUrl: string, email: string, name: string) {
  const response = await request(appUrl)
    .post("/auth/register")
    .send({
      email,
      password: "password123",
      name
    })
    .expect(201);

  return response.body as RegisteredUser;
}

function listen(server: http.Server) {
  return new Promise<string>((resolve) => {
    server.listen(0, () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        throw new Error("Expected server to listen on a TCP port");
      }

      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function waitForSocketEvent<T>(socket: Socket, event: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for socket event: ${event}`));
    }, 2000);

    function onEvent(payload: T) {
      clearTimeout(timeout);
      resolve(payload);
    }

    socket.once(event, onEvent);
  });
}

describe("socket events", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await resetTestDb();
    await disconnectTestDb();
  });

  it("emits card:created to clients in the board room", async () => {
    const app = createApp();
    const server = http.createServer(app);
    const io = createSocketServer(server);
    app.set("io", io);

    const appUrl = await listen(server);
    let client: Socket | null = null;

    try {
      const owner = await registerUser(appUrl, "socket-owner@example.com", "Socket Owner");

      const boardResponse = await request(appUrl)
        .post("/boards")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ title: "Realtime Board" })
        .expect(201);

      const boardId = boardResponse.body.board.id;

      const listResponse = await request(appUrl)
        .post(`/boards/${boardId}/lists`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ title: "Todo" })
        .expect(201);

      const listId = listResponse.body.list.id;

      client = createClient(appUrl, {
        auth: {
          token: owner.token
        },
        transports: ["websocket"]
      });

      await new Promise<void>((resolve, reject) => {
        client!.once("connect", resolve);
        client!.once("connect_error", reject);
      });

      client.emit("board:join", { boardId });
      await new Promise((resolve) => setTimeout(resolve, 50));

      const cardCreated = waitForSocketEvent<{ card: { id: string; title: string } }>(
        client,
        "card:created"
      );

      const cardResponse = await request(appUrl)
        .post(`/lists/${listId}/cards`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          title: "Broadcast this card"
        })
        .expect(201);

      const payload = await cardCreated;

      expect(payload.card.id).toBe(cardResponse.body.card.id);
      expect(payload.card.title).toBe("Broadcast this card");
    } finally {
      client?.disconnect();
      await io.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
