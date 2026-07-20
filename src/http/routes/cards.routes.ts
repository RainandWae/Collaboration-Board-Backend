import { BoardRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { emitBoardEvent } from "../../realtime/events";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { requireCardBoardRole } from "../permissions/boards";

export const cardsRouter = Router();

cardsRouter.use(requireAuth);

const updateCardSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  version: z.number().int().min(1)
});

const moveCardSchema = z.object({
    targetListId: z.string().uuid(),
    position: z.number().int().min(0),
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

cardsRouter.patch("/:cardId/move", async (req: AuthedRequest, res, next) => {
    try {
        const cardId = String(req.params.cardId);
        const input = moveCardSchema.parse(req.body);

        const access = await requireCardBoardRole(cardId, req.user!.id, [
            BoardRole.OWNER,
            BoardRole.EDITOR
        ]);

        if (!access) {
            return res.status(403).json({ error: "You cannot move this card" });
        }

        const targetList = await prisma.list.findUnique({
            where: { id: input.targetListId },
            select: {
                id: true,
                boardId: true
            }
        });

        if (!targetList) {
            return res.status(404).json({ error: "Target list not found" });
        }

        if (targetList.boardId !== access.boardId) {
            return res.status(400).json({ error: "Cannot move card to a different board" });
        }

        const result = await prisma.$transaction(async (tx) => {
            const card = await tx.card.findUniqueOrThrow({
                where: { id: cardId },
                select: {
                    id: true,
                    listId: true,
                    position: true,
                    version: true
                }
            });

            if (card.version !== input.version) {
                const latestCard = await tx.card.findUnique({
                    where: { id: cardId },
                    select: {
                        id: true, 
                        listId: true,
                        title: true,
                        description: true,
                        position: true,
                        version: true,
                        updatedAt: true
                    }
                });

                return {
                    status: "conflict" as const,
                    latestCard
                };
            }

            const sourceListId = card.listId;
            const sourcePosition = card.position;
            const targetListId = input.targetListId;

            const targetCardCount = await tx.card.count({
                where: {
                    listId: targetListId,
                    NOT: {
                        id: cardId
                    }
                }
            });

            const targetPosition = Math.min(input.position, targetCardCount);

            if (sourceListId === targetListId) {
                if (targetPosition === sourcePosition) {
                    const unchangedCard = await tx.card.findUniqueOrThrow({
                        where: { id: cardId }
                    });

                    return {
                        status: "moved" as const,
                        card: unchangedCard,
                        fromListId: sourceListId,
                        toListId: targetListId,
                        fromPosition: sourcePosition,
                        toPosition: targetPosition
                    };
                }

                if (targetPosition > sourcePosition) {
                    await tx.card.updateMany({
                        where: {
                            listId: sourceListId,
                            position: {
                                gt: sourcePosition,
                                lte: targetPosition
                            }
                        },
                        data: {
                            position: {
                                decrement: 1
                            }
                        }
                    });
                } else {
                    await tx.card.updateMany({
                        where: {
                            listId: sourceListId,
                            position: {
                                gte : targetPosition,
                                lt: sourcePosition
                            }
                        },
                        data: {
                            position: {
                                increment: 1
                            }
                        }
                    });
                }
            } else {
                await tx.card.updateMany({
                    where: {
                        listId: sourceListId,
                        position: {
                            gt: sourcePosition
                        }
                    },
                    data: {
                        position: {
                            decrement: 1
                        }
                    }
                });

                await tx.card.updateMany({
                    where: {
                        listId: targetListId,
                        position: {
                            gte: targetPosition
                        }
                    },
                    data: {
                        position: {
                            increment: 1
                        }
                    }
                });
            }

            const movedCard = await tx.card.update({
                where: { id: cardId },
                data: {
                    listId: targetListId,
                    position: targetPosition,
                    version: {
                        increment: 1
                    }
                }
            });

            return {
                status: "moved" as const,
                card: movedCard,
                fromListId: sourceListId,
                toListId: targetListId,
                fromPosition: sourcePosition,
                toPosition: targetPosition
            };
        });

        if (result.status === "conflict") {
            return res.status(409).json({
                error: "Card was updated by someone else",
                latestCard: result.latestCard
            });
        }

        await prisma.activity.create({
            data: {
                boardId: access.boardId, 
                actorId: req.user!.id,
                action: "CARD_MOVED",
                metadata: {
                    cardId: result.card.id,
                    fromListId: result.fromListId,
                    toListId: result.toListId,
                    fromPosition: result.fromPosition,
                    toPosition: result.toPosition,
                    previousVersion: input.version,
                    nextVersion: result.card.version
                }
            }
        });

        emitBoardEvent(req, access.boardId, "card:moved", {
            card: result.card,
            fromListId: result.fromListId,
            toListId: result.toListId,
            fromPosition: result.fromPosition,
            toPosition: result.toPosition
        });

        res.json({ card: result.card });
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

    emitBoardEvent(req, access.boardId, "card:updated", { card: updatedCard });

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

    emitBoardEvent(req, access.boardId, "card:deleted", { cardId });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
