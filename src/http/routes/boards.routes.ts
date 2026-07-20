import { BoardRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { requireBoardRole } from "../permissions/boards";

export const boardsRouter = Router();

boardsRouter.use(requireAuth);

const createBoardSchema = z.object({
  title: z.string().min(1)
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["EDITOR", "VIEWER"]).default("VIEWER")
});

const createListSchema = z.object({
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

boardsRouter.get("/:boardId/lists", async (req: AuthedRequest, res, next) => {
  try {
    const boardId = String(req.params.boardId);

    const membership = await requireBoardRole(boardId, req.user!.id, [
      BoardRole.OWNER,
      BoardRole.EDITOR,
      BoardRole.VIEWER
    ]);

    if (!membership) {
      return res.status(403).json({ error: "You do not have access to this board" });
    }

    const lists = await prisma.list.findMany({
      where: { boardId },
      orderBy: { position: "asc" },
      include: {
        cards: {
          orderBy: { position: "asc" }
        }
      }
    });

    res.json({ lists });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/:boardId/lists", async (req: AuthedRequest, res, next) => {
  try {
    const boardId = String(req.params.boardId);
    const input = createListSchema.parse(req.body);

    const membership = await requireBoardRole(boardId, req.user!.id, [
      BoardRole.OWNER,
      BoardRole.EDITOR
    ]);

    if (!membership) {
      return res.status(403).json({ error: "You cannot create lists on this board" });
    }

    const lastList = await prisma.list.aggregate({
      where: { boardId },
      _max: {
        position: true
      }
    });

    const nextPosition = (lastList._max.position ?? -1) + 1;

    const list = await prisma.list.create({
      data: {
        boardId,
        title: input.title,
        position: nextPosition
      }
    });

    await prisma.activity.create({
      data: {
        boardId,
        actorId: req.user!.id,
        action: "LIST_CREATED",
        metadata: {
          listId: list.id,
          title: list.title
        }
      }
    });

    res.status(201).json({ list });
  } catch (error) {
    next(error);
  }
});

boardsRouter.get("/:boardId", async (req: AuthedRequest, res, next) => {
  try {
    const boardId = String(req.params.boardId);
    const membership = await requireBoardRole(boardId, req.user!.id, [
      BoardRole.OWNER,
      BoardRole.EDITOR,
      BoardRole.VIEWER
    ]);

    if (!membership) {
      return res.status(403).json({ error: "You do not have access to this board" });
    }

    const board = await prisma.board.findUniqueOrThrow({
      where: { id: boardId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true }
            }
          }
        },
        lists: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" }
            }
          }
        }
      }
    });

    res.json({ board, role: membership.role });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/:boardId/members", async (req: AuthedRequest, res, next) => {
  try {
    const boardId = String(req.params.boardId);
    const input = addMemberSchema.parse(req.body);
    const membership = await requireBoardRole(boardId, req.user!.id, [BoardRole.OWNER]);

    if (!membership) {
      return res.status(403).json({ error: "Only board owners can add members" });
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const member = await prisma.boardMember.upsert({
      where: {
        boardId_userId: {
          boardId,
          userId: user.id
        }
      },
      create: {
        boardId,
        userId: user.id,
        role: input.role
      },
      update: {
        role: input.role
      },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    res.status(201).json({ member });
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
