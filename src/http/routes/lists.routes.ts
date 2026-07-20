import { BoardRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { requireListBoardRole } from "../permissions/boards";
import { emitBoardEvent } from "../../realtime/events";

export const listsRouter = Router();

listsRouter.use(requireAuth);

const updateListSchema = z.object({
  title: z.string().min(1).optional(),
  position: z.number().int().min(0).optional()
});

const createCardSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional()
});

listsRouter.get("/:listId/cards", async (req:AuthedRequest, res, next) => {
    try {
        const listId = String(req.params.listId);

        const access = await requireListBoardRole(listId, req.user!.id, [
            BoardRole.OWNER,
            BoardRole.EDITOR,
            BoardRole.VIEWER
        ]);

        if (!access) {
            return res.status(403).json({ error: "You cannot view cards in this list" });
        }

        const cards = await prisma.card.findMany({
            where: { listId },
            orderBy: { position: "asc" },
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
                            select: { id: true, email: true, name: true}
                        }
                    }
                }
            }
        });

        res.json({ cards });
    } catch (error) {
        next(error);
    }
});

listsRouter.post("/:listId/cards", async (req: AuthedRequest, res, next) => {
    try {
        const listId = String(req.params.listId);
        const input = createCardSchema.parse(req.body);

        const access = await requireListBoardRole(listId, req.user!.id, [
            BoardRole.OWNER,
            BoardRole.EDITOR
        ]);

        if (!access) {
            return res.status(403).json({ error: "You cannot create cards in this list" });
        }

        const lastCard = await prisma.card.aggregate({
            where: { listId },
            _max: {
                position: true
            }
        });

        const nextPosition = (lastCard._max.position ?? -1) + 1;

        const card = await prisma.card.create({
            data: {
                listId,
                title: input.title,
                description: input.description,
                position: nextPosition
            }
        });

        await prisma.activity.create({
            data: {
                boardId: access.list.boardId,
                actorId: req.user!.id,
                action: "CARD_CREATED",
                metadata: {
                    cardId: card.id,
                    listId,
                    title: card.title
                }
            }
        });

        emitBoardEvent(req, access.list.boardId, "card:created", { card });

        res.status(201).json({ card });
    } catch (error) {
        next(error);
    }
});

listsRouter.patch("/:listId", async (req: AuthedRequest, res, next) => {
    try {
        const listId = String(req.params.listId);
        const input = updateListSchema.parse(req.body);

        const access = await requireListBoardRole(listId, req.user!.id, [
            BoardRole.OWNER,
            BoardRole.EDITOR,
        ]);

        if (!access) {
            return res.status(403).json({ error: "You cannot update this list" });
        }

        const list = await prisma.list.update({
            where: { id: listId },
            data: input
        });
        
        emitBoardEvent(req, access.list.boardId, "list:updated", { list });

        res.json({ list });
    } catch (error) {
        next(error);
    }
});

listsRouter.delete("/:listId", async (req: AuthedRequest, res, next) => {
    try {
        const listId = String(req.params.listId);

        const access = await requireListBoardRole(listId, req.user!.id, [
            BoardRole.OWNER,
            BoardRole.EDITOR
        ]);

        if (!access) {
            return res.status(403).json({ error: "You cannot delete this list" });
        }

        await prisma.list.delete({
            where: { id: listId }
        });

        emitBoardEvent(req, access.list.boardId, "list:deleted", { listId });

        res.status(204).send();
    } catch (error) {
        next(error);
    }
});
