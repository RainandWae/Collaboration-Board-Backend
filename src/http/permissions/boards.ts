import type { BoardRole } from "@prisma/client";
import { prisma } from "../../db/prisma";

export async function getBoardMembership(boardId: string, userId: string) {
  return prisma.boardMember.findUnique({
    where: {
      boardId_userId: {
        boardId,
        userId
      }
    }
  });
}

export async function requireBoardRole(boardId: string, userId: string, allowedRoles: BoardRole[]) {
  const membership = await getBoardMembership(boardId, userId);

  if (!membership || !allowedRoles.includes(membership.role)) {
    return null;
  }

  return membership;
}

export async function requireListBoardRole(listId: string, userId: string, allowedRoles: BoardRole[]) {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    select: {
      id: true,
      boardId: true
    }
  });

  if (!list) {
    return null;
  }

  const membership = await requireBoardRole(list.boardId, userId, allowedRoles);

  if (!membership) {
    return null;
  }

  return {
    list, 
    membership
  };
}

export async function requireCardBoardRole(cardId: string, userId: string, allowedRoles: BoardRole[]) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      listId: true,
      list: {
        select: {
          boardId: true
        }
      }
    }
  });

  if (!card) {
    return null;
  }

  const membership = await requireBoardRole(card.list.boardId, userId, allowedRoles);

  if (!membership) {
    return null;
  }

  return {
    card,
    boardId: card.list.boardId,
    membership
  };
}