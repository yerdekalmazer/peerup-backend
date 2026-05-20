import { Router } from "express";
import { prisma } from "../prisma";
import { serializeTeacher, serializeChain } from "../serialize";

export const publicRouter = Router();

// GET /teachers?category=&q=
publicRouter.get("/teachers", async (req, res) => {
  const category = req.query.category as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();

  const teachers = await prisma.teacher.findMany({
    where: {
      ...(category && category !== "Tümü" ? { category } : {}),
      ...(q
        ? { OR: [{ name: { contains: q } }, { skill: { contains: q } }] }
        : {}),
    },
    orderBy: { rating: "desc" },
  });
  res.json(teachers.map(serializeTeacher));
});

// GET /teachers/:id — detay + değerlendirmeler
publicRouter.get("/teachers/:id", async (req, res) => {
  const teacher = await prisma.teacher.findUnique({
    where: { id: req.params.id },
    include: {
      reviewList: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, avatar: true, avatarColor: true } } },
      },
    },
  });
  if (!teacher) return res.status(404).json({ error: "Öğretmen bulunamadı" });
  res.json(serializeTeacher(teacher));
});

// GET /categories
publicRouter.get("/categories", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
  });
  res.json(categories);
});

// GET /chains
publicRouter.get("/chains", async (_req, res) => {
  const chains = await prisma.skillChain.findMany({
    include: { nodes: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(chains.map(serializeChain));
});

// GET /leaders — topluluk lider tablosu (oturum sayısına göre)
publicRouter.get("/leaders", async (_req, res) => {
  const teachers = await prisma.teacher.findMany({
    orderBy: [{ sessionsCount: "desc" }, { rating: "desc" }],
    take: 20,
  });
  res.json(
    teachers.map((t, i) => ({
      rank: i + 1,
      name: t.name,
      avatar: t.avatar,
      avatarColor: t.avatarColor,
      skill: t.skill,
      chainScore: t.sessionsCount * 2 + Math.round(t.rating * 10),
      reach: t.sessionsCount,
    })),
  );
});
