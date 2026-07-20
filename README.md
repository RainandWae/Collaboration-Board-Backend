# Collaboration Board Backend

A real-time collaborative task and notes board backend, built as an intermediate-size backend project focused on relational modeling, role-based access control, WebSockets, transactions, and conflict handling.

## Tech Stack

- Node.js, TypeScript, Express
- PostgreSQL and Prisma
- Redis and BullMQ
- Socket.io
- JWT authentication
- Jest and Supertest
- Docker Compose for local infrastructure

## Local Setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

The API runs on:

```text
http://localhost:4000
```

Health check:

```http
GET /health
```

## Environment Variables

See `.env.example`.

Required values:

```text
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://syncboard:syncboard@localhost:5432/syncboard?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-at-least-16-characters
CORS_ORIGIN=http://localhost:3000
```

## Implemented Features

### Auth

```http
POST /auth/register
POST /auth/login
GET  /auth/me
```

Auth uses JWT bearer tokens.

### Boards

```http
GET  /boards
POST /boards
GET  /boards/:boardId
```

Boards include members, lists, and cards when fetched by id.

### Board Members and Roles

```http
POST /boards/:boardId/members
```

Supported roles:

```text
OWNER
EDITOR
VIEWER
```

Permissions are checked through board membership. `OWNER` and `EDITOR` can mutate board content. `VIEWER` can read board content.

### Lists

```http
GET    /boards/:boardId/lists
POST   /boards/:boardId/lists
PATCH  /lists/:listId
DELETE /lists/:listId
```

Lists are ordered by `position`.

### Cards

```http
GET    /lists/:listId/cards
POST   /lists/:listId/cards
GET    /cards/:cardId
PATCH  /cards/:cardId
DELETE /cards/:cardId
PATCH  /cards/:cardId/move
```

Cards are ordered by `position` inside a list.

### Optimistic Concurrency

Card updates and moves require the current card `version`.

If the submitted version is stale, the API returns:

```http
409 Conflict
```

with the latest card data.

Example card update:

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "version": 2
}
```

### Card Move Transactions

`PATCH /cards/:cardId/move` moves a card within a list or across lists. The operation runs inside a Prisma transaction and shifts surrounding card positions atomically.

Example:

```json
{
  "targetListId": "list-id",
  "position": 0,
  "version": 2
}
```

### Real-Time Events

Socket.io clients can join a board room:

```text
board:join
```

Payload:

```json
{
  "boardId": "board-id"
}
```

The backend broadcasts these board events:

```text
list:created
list:updated
list:deleted
card:created
card:updated
card:deleted
card:moved
```

Events are emitted to:

```text
board:{boardId}
```

## Testing

```bash
npm run build
npm run test
```

## Remaining Roadmap

1. Comments on cards.
2. `@mentions` in comments.
3. BullMQ notification jobs for mentions.
4. Activity log read endpoints.
5. PostgreSQL full-text search over cards.
6. More integration tests for auth, permissions, cards, moves, conflicts, and Socket.io behavior.
7. Refresh tokens and stronger production auth/session handling.
