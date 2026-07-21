import type { Server } from "http";
import { Server as SocketServer } from "socket.io";
import { verifyAccessToken } from "../auth/jwt";
import { corsOrigins } from "../config/env";

export function createSocketServer(httpServer: Server) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (typeof token !== "string") {
      return next(new Error("Missing socket auth token"));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.user = { id: payload.sub, email: payload.email };
      return next();
    } catch {
      return next(new Error("Invalid socket auth token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("board:join", ({ boardId }: { boardId: string }) => {
      socket.join(`board:${boardId}`);
    });

    socket.on("board:leave", ({ boardId }: { boardId: string }) => {
      socket.leave(`board:${boardId}`);
    });
  });

  return io;
}
