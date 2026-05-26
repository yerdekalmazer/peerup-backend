import { Router } from "express";
import { prisma } from "../prisma";
import { serializeTeacher, serializeChain, safeParse } from "../serialize";

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

/**
 * GET /teachers/:id/availability?date=YYYY-MM-DD
 *
 * Belirli bir tarihte mentor'un haftalık müsait aralıklarına düşen 30 dk'lık
 * slotları döner. `bookedTimes` aynı tarihte bu öğretmen için zaten alınmış
 * (upcoming) oturumların saatlerini içerir — frontend `availableTimes`
 * içinden bunları çıkarır.
 */
publicRouter.get("/teachers/:id/availability", async (req, res) => {
  const teacher = await prisma.teacher.findUnique({
    where: { id: req.params.id },
  });
  if (!teacher) return res.status(404).json({ error: "Öğretmen bulunamadı" });

  const dateStr = String(req.query.date ?? "");
  const date = new Date(`${dateStr}T00:00:00`);
  if (!dateStr || Number.isNaN(date.getTime())) {
    return res.status(400).json({ error: "date=YYYY-MM-DD gerekli" });
  }
  const dayOfWeek = date.getDay();

  type Slot = { dayOfWeek: number; start: string; end: string };
  const rules: Slot[] = safeParse(teacher.availability) as Slot[];
  const todayRules = rules.filter((r) => r?.dayOfWeek === dayOfWeek);

  // Aralıkları 30 dk slotlara aç
  const availableTimes: string[] = [];
  for (const r of todayRules) {
    const [sh, sm] = r.start.split(":").map(Number);
    const [eh, em] = r.end.split(":").map(Number);
    let mins = sh * 60 + sm;
    const end = eh * 60 + em;
    while (mins + 30 <= end) {
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      availableTimes.push(`${hh}:${mm}`);
      mins += 30;
    }
  }

  // Aynı gün için bu öğretmende alınmış upcoming oturumlar (frontend tarih
  // formatı "26 Mayıs 2026" — Türkçe locale ile karşılaştırma)
  const localized = date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const sessions = await prisma.session.findMany({
    where: {
      teacherName: teacher.name,
      status: "upcoming",
      date: localized,
    },
    select: { time: true },
  });
  const bookedTimes = sessions.map((s) => s.time);

  res.json({ availableTimes, bookedTimes, dayOfWeek });
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
