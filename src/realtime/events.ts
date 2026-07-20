import type { Request } from "express";
import type { Server as SocketServer } from "socket.io";

export function getSocketServer(req: Request) {
  return req.app.get("io") as SocketServer | undefined;
}

export function emitBoardEvent(req: Request, boardId: string, event: string, payload: unknown) {
  const io = getSocketServer(req);

  if (!io) {
    return;
  }

  io.to(`board:${boardId}`).emit(event, payload);
}
