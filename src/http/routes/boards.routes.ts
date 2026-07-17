import { BoardRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const boardsRouter = Router();

boardsRouter.use(requireAuth);

const createBoardSchema = z.object({
  title: z.string().min(1)
});

boardsRouter.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const input = createBoardSchema.parse(req.body);
    const board = await prisma.board.create({
      data: {
        title: input.title,
        members: {
          create: {
            userId: req.user!.id,
            role: BoardRole.OWNER
          }
        },
        activities: {
          create: {
            actorId: req.user!.id,
            action: "BOARD_CREATED",
            metadata: { title: input.title }
          }
        }
      }
    });

    res.status(201).json({ board });
  } catch (error) {
    next(error);
  }
});

boardsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const boards = await prisma.board.findMany({
      where: {
        members: {
          some: { userId: req.user!.id }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({ boards });
  } catch (error) {
    next(error);
  }
});
