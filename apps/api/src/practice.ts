import { prisma } from "./db";

export function findPractice(slug: string) {
  return prisma.practice.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, webhookSecret: true } });
}

export function listPractices() {
  return prisma.practice.findMany({ select: { id: true, slug: true, name: true }, orderBy: { name: "asc" } });
}
