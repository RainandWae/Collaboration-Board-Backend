# Collaboration Board Backend

A real-time collaborative task and notes board project, built to practice backend problems that are different from file upload/image-processing APIs: relational modeling, role-based access control, WebSockets, transactions, background jobs, health checks, API documentation, and production Docker setup.

## Tech Stack

- Node.js, TypeScript, Express
- PostgreSQL, Prisma, and SQL transactions
- Redis and BullMQ
- Socket.io
- JWT authentication
- React, TypeScript, and Vite frontend
- OpenAPI / Swagger API docs
- Pino structured HTTP logging
- Jest, Supertest, and socket.io-client
- Docker Compose for local infrastructure and production-style containers
- GitHub Actions CI for backend and frontend checks

## Local Setup

Install backend and frontend dependencies:

```bash
npm install
npm --prefix client install
```

Create your environment file:

```bash
cp .env.example .env
```

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Start the API:

```bash
npm run dev
```

The API runs on:

```text
http://localhost:4000
```

Start the React frontend in another terminal:

```bash
npm run dev:client
```

The frontend normally runs on:

```text
http://localhost:3000
```

If port `3000` is already in use, Vite will automatically use the next available port, usually:

```text
http://localhost:3001
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
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

`JWT_SECRET` must be at least 16 characters.

## API Docs

Swagger UI:

```http
GET /docs
```

Raw OpenAPI JSON:

```http
GET /docs.json
```

Use this when you want to inspect available routes, request bodies, response shapes, and auth requirements.

## Health Checks

Basic health check:

```http
GET /health
```

Liveness check:

```http
GET /health/live
```

Readiness check:

```http
GET /health/ready
```

`/health/live` only confirms the API process is alive. `/health/ready` checks whether the API can reach PostgreSQL and Redis, which is the endpoint used by the production Docker health check.

Example:

```bash
curl.exe http://localhost:4000/health/live
curl.exe http://localhost:4000/health/ready
```

## Implemented Features

### Frontend

The `client/` directory contains a React + TypeScript + Vite frontend. It includes:

- Login and registration
- Board selection and board creation
- Member invite form with board roles
- List and card creation
- Drag-and-drop card movement
- Card editing with version-aware conflict feedback
- Card comments with email mentions
- Board activity feed
- Card search
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
comment:created
member:added
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

The activity log returns recent board activity with actor details. Pagination uses a cursor:

```http
GET /boards/:boardId/activity?limit=20&cursor=activity-id
```

### Search

```http
GET /search/cards?q=search-term&limit=20
```

Card search checks card `title` and `description`, and only returns cards from boards where the authenticated user is a member.

### Structured Errors and Request IDs

Every request gets an `x-request-id` response header. Clients can also send their own `x-request-id`, which is reused by the API.

Error responses use a consistent structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "requestId": "request-id"
  }
}
```

HTTP requests are logged with Pino so request IDs, method, path, status code, and errors are easier to trace.

## Production Docker

Build the production image:

```bash
docker compose -f docker-compose.prod.yml build
```

Start the production-style stack:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Check container status:

```bash
docker compose -f docker-compose.prod.yml ps
```

Check API readiness:

```bash
curl.exe http://localhost:4000/health/ready
```

Stop the production-style stack:

```bash
docker compose -f docker-compose.prod.yml down
```

The production compose file starts PostgreSQL, Redis, and the API. The API container runs Prisma migrations before starting `node dist/server.js`.

## Testing

Tests require the local PostgreSQL database to be running:

```bash
docker compose up -d
```

Run backend checks:

```bash
npm run format:check
npm run build
npm run test
```

Run frontend checks:

```bash
npm --prefix client run format:check
npm --prefix client run build
```

The current backend test suite covers:

- Health checks
- Auth and board collaboration flow
- Board role permissions
- List/card creation
- Optimistic concurrency conflict handling
- Card move transaction behavior
- Comments and mention notification queueing
- Card search
- Socket.io event delivery to board rooms

Jest runs with `maxWorkers: 1` because the integration tests share and reset the same local test database.

## CI

GitHub Actions runs on pushes and pull requests.

The backend job runs:

- Dependency install
- Prisma generate
- Prisma migrations against a PostgreSQL service container
- Format check
- TypeScript build
- Jest tests

The frontend job runs:

- Dependency install
- Format check
- TypeScript/Vite build

## Remaining Roadmap

These are the main backend features still worth adding. They are ordered by how useful they are for showing stronger backend engineering experience.

1. Rate limiting and security hardening

   Add request limits for sensitive endpoints such as login, register, invites, and comments. This should include per-IP and per-account throttling, better auth abuse protection, stricter production CORS settings, and security-focused tests.

2. Refresh tokens and session management

   Replace the current simple JWT-only login flow with short-lived access tokens and longer-lived refresh tokens. Store refresh token records in PostgreSQL so sessions can be rotated, revoked, expired, and listed per user.

3. PostgreSQL full-text search

   Upgrade the current basic card search to real PostgreSQL full-text search using `tsvector`, weighted ranking, indexes, and pagination. This would make the search feature more realistic and show database-level query optimization.

4. Labels and tags

   Add full labels/tags support for cards, including routes, permissions, filtering, search integration, realtime events, and frontend controls. This would exercise many-to-many relationships and practical query design.

5. Notification delivery worker

   Turn the current mention queue into a fuller worker flow with retry handling, failed-job logging, and a mock email provider. Add tests for queued jobs, retries, and notification records.

6. Stronger Socket.io test coverage

   Add integration tests for more realtime events: card moves, card edits, comments, member invites, disconnect/reconnect behavior, and unauthorized board room joins.

7. Audit log improvements

   Expand activity tracking so important actions are consistently recorded across boards, members, lists, cards, comments, labels, and permissions. Add filters by actor, action type, and date range.

8. Deployment documentation

   Add a real deployment guide for a cloud target such as Render, Railway, Fly.io, AWS ECS, or DigitalOcean. Include production environment variables, managed Postgres/Redis setup, migrations, health checks, and frontend API URL configuration.
