import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

export const searchRouter = Router();

searchRouter.use(requireAuth);

const searchCardsQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

searchRouter.get("/cards", async (req: AuthedRequest, res, next) => {
  try {
    const query = searchCardsQuerySchema.parse(req.query);

    const cards = await prisma.card.findMany({
      where: {
        OR: [
          {
            title: {
              contains: query.q,
              mode: "insensitive"
            }
          },
          {
            description: {
              contains: query.q,
              mode: "insensitive"
            }
          }
        ],
        list: {
          board: {
            members: {
              some: {
                userId: req.user!.id
              }
            }
          }
        }
      },
      take: query.limit,
      orderBy: {
        updatedAt: "desc"
      },
      include: {
        list: {
          select: {
            id: true,
            title: true,
            board: {
              select: {
                id: true,
                title: true
              }
            }
          }
        },
        labels: {
          include: {
            label: true
          }
        }
      }
    });

    res.json({ cards });
  } catch (error) {
    next(error);
  }
});
