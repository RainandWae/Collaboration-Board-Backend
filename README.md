# SyncBoard Backend

A barebones backend scaffold for a real-time collaborative task and notes board.

## Stack

- Node.js, TypeScript, Express
- PostgreSQL, Prisma
- Redis, BullMQ
- Socket.io
- Jest, Supertest, socket.io-client
- Docker Compose for local Postgres and Redis

## First Run

```bash
cp .env.example .env
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Health check:

```bash
GET http://localhost:4000/health
```

## MVP Roadmap

1. Auth: register, login, refresh tokens.
2. Boards/lists/cards CRUD with per-board roles.
3. Socket.io board rooms and real-time card/list events.
4. Card movement transactions and optimistic concurrency via `Card.version`.
5. Comments and `@mentions`, queued through BullMQ.
6. Postgres full-text search over cards.
7. Activity log endpoints.
8. Integration tests for REST and socket behavior.
