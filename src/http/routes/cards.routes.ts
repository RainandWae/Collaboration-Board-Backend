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
  description: z.string().optional(),
  version: z.number().int().min(1)
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

    const card = await prisma.card.updateMany({
      where: {
        id: cardId,
        version: input.version
      },
      data: {
        title: input.title,
        description: input.description,
        version: {
          increment: 1
        }
      }
    });

    if (card.count === 0) {
      const latestCard = await prisma.card.findUnique({
        where: { id: cardId },
        select: {
          id: true,
          title: true,
          description: true,
          position: true,
          version: true,
          updatedAt: true
        }
      });

      return res.status(409).json({
        error: "Card was updated by someone else",
        latestCard
      });
    }

    const updatedCard = await prisma.card.findUniqueOrThrow({
      where: { id: cardId }
    });

    await prisma.activity.create({
      data: {
        boardId: access.boardId,
        actorId: req.user!.id,
        action: "CARD_UPDATED",
        metadata: {
          cardId: updatedCard.id,
          title: updatedCard.title,
          previousVersion: input.version,
          nextVersion: updatedCard.version
        }
      }
    });

    res.json({ card: updatedCard });
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