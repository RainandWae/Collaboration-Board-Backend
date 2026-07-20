process.env.NODE_ENV = "test";
process.env.PORT = "4000";
process.env.DATABASE_URL =
  "postgresql://syncboard:syncboard@localhost:5432/syncboard?schema=public";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "test-secret-at-least-sixteen-chars";
process.env.CORS_ORIGIN = "http://localhost:3000";
