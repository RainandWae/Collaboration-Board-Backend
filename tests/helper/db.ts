import { prisma } from "../../src/db/prisma";

export async function resetTestDb() {
  await prisma.cardLabel.deleteMany();
  await prisma.label.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.card.deleteMany();
  await prisma.list.deleteMany();
  await prisma.boardMember.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectTestDb() {
  await prisma.$disconnect();
}
