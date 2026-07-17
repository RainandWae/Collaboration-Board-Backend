import { Queue, Worker } from "bullmq";
import { redis } from "./connection";

export type MentionNotificationJob = {
  boardId: string;
  cardId: string;
  mentionedUserId: string;
  authorId: string;
};

export const notificationsQueue = new Queue<MentionNotificationJob>("notifications", {
  connection: redis
});

export function startNotificationWorker() {
  return new Worker<MentionNotificationJob>(
    "notifications",
    async (job) => {
      console.log("send mention notification", job.data);
    },
    { connection: redis }
  );
}
