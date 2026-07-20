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
npm --prefix client install
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

The React frontend runs on:

```bash
npm run dev:client
```

```text
http://localhost:3000
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

### Frontend

The `client/` directory contains a React + TypeScript + Vite frontend. It includes:

- login and registration
- board selection and board creation
- list and card creation
- card editing with version-aware conflict feedback
- card moving between lists
- card comments with email mentions
- board activity feed
- card search
- Socket.io live board refresh

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
GET    /cards/:cardId/comments
POST   /cards/:cardId/comments
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

### Comments and Mentions

Cards support comments through:

```http
GET  /cards/:cardId/comments
POST /cards/:cardId/comments
```

Comment bodies can mention board members by email:

```text
Please review this @user@example.com
```

When a mentioned email belongs to a user who is a member of the same board, the API queues a BullMQ `mention` notification job.

### Activity Log

```http
GET /boards/:boardId/activity?limit=20
```

The activity log returns recent board activity with actor details. Supported activity types currently include:

```text
BOARD_CREATED
LIST_CREATED
CARD_CREATED
CARD_UPDATED
CARD_MOVED
COMMENT_CREATED
```

Pagination uses a cursor:

```http
GET /boards/:boardId/activity?limit=20&cursor=activity-id
```

### Search

```http
GET /search/cards?q=search-term&limit=20
```

Card search checks card `title` and `description`, and only returns cards from boards where the authenticated user is a member.

## Testing

Tests require the local PostgreSQL database to be running:

```bash
docker compose up -d
```

Run:

```bash
npm run build
npm run test
```

The current test suite covers:

- health check
- auth and board collaboration flow
- board role permissions
- list/card creation
- optimistic concurrency conflict handling
- card move transaction behavior
- comments and mention notification queueing
- card search
- Socket.io `card:created` delivery to board rooms

Jest runs with `maxWorkers: 1` because the integration tests share and reset the same local test database.

## Remaining Roadmap

1. Extract shared integration test helpers.
2. Refactor repeated route patterns carefully.
3. Add structured error handling.
4. Add formatter/linter workflow.
5. Upgrade search to PostgreSQL full-text search.
6. Add more Socket.io event tests.
7. Add refresh tokens and stronger production auth/session handling.
8. Add rate limiting for auth endpoints.
