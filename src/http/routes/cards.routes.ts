import { BoardRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { requireCardBoardRole } from "../permissions/boards";

export const cardsRouter = Router();

cardsRouter.use(requireAuth);

const updateCardSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional()
});

cardsRouter.get("/:cardId", async (req: AuthedRequest, res, next) => {
  try {
    const cardId = String(req.params.cardId);

    const access = await requireCardBoardRole(cardId, req.user!.id, [
      BoardRole.OWNER,
      BoardRole.EDITOR,
      BoardRole.VIEWER
    ]);

    if (!access) {
      return res.status(403).json({ error: "You cannot view this card" });
    }

    const card = await prisma.card.findUniqueOrThrow({
      where: { id: cardId },
      include: {
        labels: {
          include: {
            label: true
          }
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: { id: true, email: true, name: true }
            }
          }
        }
      }
    });

    res.json({ card });
  } catch (error) {
    next(error);
  }
});

cardsRouter.patch("/:cardId", async (req: AuthedRequest, res, next) => {
  try {
    const cardId = String(req.params.cardId);
    const input = updateCardSchema.parse(req.body);

    const access = await requireCardBoardRole(cardId, req.user!.id, [
      BoardRole.OWNER,
      BoardRole.EDITOR
    ]);

    if (!access) {
      return res.status(403).json({ error: "You cannot update this card" });
    }

    const card = await prisma.card.update({
      where: { id: cardId },
      data: {
        ...input,
        version: {
          increment: 1
        }
      }
    });

    await prisma.activity.create({
      data: {
        boardId: access.boardId,
        actorId: req.user!.id,
        action: "CARD_UPDATED",
        metadata: {
          cardId: card.id,
          title: card.title
        }
      }
    });

    res.json({ card });
  } catch (error) {
    next(error);
  }
});

cardsRouter.delete("/:cardId", async (req: AuthedRequest, res, next) => {
  try {
    const cardId = String(req.params.cardId);

    const access = await requireCardBoardRole(cardId, req.user!.id, [
      BoardRole.OWNER,
      BoardRole.EDITOR
    ]);

    if (!access) {
      return res.status(403).json({ error: "You cannot delete this card" });
    }

    await prisma.card.delete({
      where: { id: cardId }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});