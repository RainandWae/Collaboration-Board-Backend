import http from "http";
import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { createApp } from "./http/app";
import { startNotificationWorker } from "./queue/notifications.queue";
import { redis } from "./queue/connection";
import { createSocketServer } from "./realtime/socket";

async function main() {
  const app = createApp();
  const server = http.createServer(app);
  createSocketServer(server);
  const notificationWorker = startNotificationWorker();

  server.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });

  async function shutdown() {
    await notificationWorker.close();
    await redis.quit();
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
