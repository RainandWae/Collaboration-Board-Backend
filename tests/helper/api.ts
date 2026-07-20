import request from "supertest";

type RequestTarget = Parameters<typeof request>[0];

export type RegisteredUser = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
};

export function authHeader(token: string) {
  return {
    Authorization: `Bearer ${token}`
  };
}

export async function registerUser(app: RequestTarget, email: string, name: string) {
  const response = await request(app)
    .post("/auth/register")
    .send({
      email,
      password: "password123",
      name
    })
    .expect(201);

  return response.body as RegisteredUser;
}

export async function createBoard(app: RequestTarget, token: string, title: string) {
  const response = await request(app)
    .post("/boards")
    .set(authHeader(token))
    .send({ title })
    .expect(201);

  return response.body.board;
}

export async function addBoardMember(
  app: RequestTarget,
  token: string,
  boardId: string,
  email: string,
  role: "EDITOR" | "VIEWER"
) {
  const response = await request(app)
    .post(`/boards/${boardId}/members`)
    .set(authHeader(token))
    .send({ email, role })
    .expect(201);

  return response.body.member;
}

export async function createList(
  app: RequestTarget,
  token: string,
  boardId: string,
  title: string
) {
  const response = await request(app)
    .post(`/boards/${boardId}/lists`)
    .set(authHeader(token))
    .send({ title })
    .expect(201);

  return response.body.list;
}

export async function createCard(
  app: RequestTarget,
  token: string,
  listId: string,
  title: string,
  description?: string
) {
  const response = await request(app)
    .post(`/lists/${listId}/cards`)
    .set(authHeader(token))
    .send({
      title,
      ...(description ? { description } : {})
    })
    .expect(201);

  return response.body.card;
}
