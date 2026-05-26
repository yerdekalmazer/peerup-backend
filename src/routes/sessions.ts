import { Router } from "express";
import { prisma } from "../prisma";
import { requireUser } from "../auth";
import { serializeSession } from "../serialize";
import { sendPushToUser } from "../push";

export const sessionsRouter = Router();
sessionsRouter.use(requireUser);

// GET /sessions?status= — oturum açmış kullanıcının oturumları
sessionsRouter.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const sessions = await prisma.session.findMany({
    where: { userId: req.userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
  res.json(sessions.map(serializeSession));
});

// POST /sessions — yeni rezervasyon (SkillCoin düşülür)
sessionsRouter.post("/", async (req, res) => {
  const b = req.body ?? {};
  const teacherName = String(b.teacherName ?? "").trim();
  const skill = String(b.skill ?? "").trim();
  const date = String(b.date ?? "").trim();
  const time = String(b.time ?? "").trim();
  if (!teacherName || !skill || !date || !time) {
    return res
      .status(400)
      .json({ error: "Öğretmen, beceri, tarih ve saat zorunludur" });
  }

  const cost = Number(b.cost ?? 1);
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: "Kullanıcı bulunamadı" });
  if (user.coins < cost) {
    return res.status(400).json({ error: "Yetersiz SkillCoin bakiyesi" });
  }

  const teacher = await prisma.teacher.findFirst({
    where: { name: teacherName },
  });

  const session = await prisma.session.create({
    data: {
      userId: req.userId,
      teacherName,
      teacherAvatar: teacher?.avatar ?? String(b.teacherAvatar ?? ""),
      avatarColor: teacher?.avatarColor ?? String(b.avatarColor ?? "#6366F1"),
      skill,
      date,
      time,
      duration: Number(b.duration ?? 60),
      cost,
      type: String(b.type ?? "online"),
      status: "upcoming",
    },
  });

  // Bakiyeden düş + işlem kaydı + bildirim
  await prisma.user.update({
    where: { id: req.userId },
    data: { coins: { decrement: cost } },
  });
  await prisma.coinTransaction.create({
    data: {
      userId: req.userId!,
      amount: -cost,
      type: "spend",
      description: `${skill} oturumu rezervasyonu`,
    },
  });
  await prisma.notification.create({
    data: {
      userId: req.userId!,
      type: "session",
      title: "Rezervasyon onaylandı ✅",
      body: `${teacherName} ile ${date} ${time} oturumun planlandı.`,
      icon: "calendar-outline",
    },
  });
  void sendPushToUser(req.userId!, {
    title: "Rezervasyon onaylandı ✅",
    body: `${teacherName} ile ${date} ${time} oturumun planlandı.`,
    data: { type: "session", sessionId: session.id },
  });

  res.status(201).json(serializeSession(session));
});

// PATCH /sessions/:id — durum güncelle (örn. iptal — iptalde ücret iadesi)
sessionsRouter.patch("/:id", async (req, res) => {
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!session) return res.status(404).json({ error: "Oturum bulunamadı" });

  const status = String(req.body?.status ?? "");
  if (!["upcoming", "completed", "cancelled"].includes(status)) {
    return res.status(400).json({ error: "Geçersiz durum" });
  }

  if (status === "cancelled" && session.status === "upcoming") {
    await prisma.user.update({
      where: { id: req.userId },
      data: { coins: { increment: session.cost } },
    });
    await prisma.coinTransaction.create({
      data: {
        userId: req.userId!,
        amount: session.cost,
        type: "refund",
        description: `${session.skill} oturumu iptal iadesi`,
      },
    });
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { status },
  });
  res.json(serializeSession(updated));
});

/**
 * Görüntülü görüşme — Jitsi Meet üzerinden harici linkle açılır.
 * Mentor (oturumdaki `teacherName` ile adı eşleşen kullanıcı) görüşmeyi başlatır;
 * öğrenci (`session.userId`) `callStarted` true olunca odaya katılabilir.
 */
function jitsiRoomFor(sessionId: string) {
  return `peerup-${sessionId}`;
}

// POST /sessions/:id/call/start — sadece mentor başlatabilir
sessionsRouter.post("/:id/call/start", async (req, res) => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id },
  });
  if (!session) return res.status(404).json({ error: "Oturum bulunamadı" });
  if (session.status !== "upcoming") {
    return res.status(400).json({ error: "Sadece yaklaşan oturumlar başlatılabilir" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: "Kullanıcı bulunamadı" });
  if (user.name !== session.teacherName) {
    return res.status(403).json({ error: "Sadece mentor görüşmeyi başlatabilir" });
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      callStarted: true,
      callRoomId: session.callRoomId ?? jitsiRoomFor(session.id),
      callStartedAt: session.callStartedAt ?? new Date(),
    },
  });

  if (session.userId) {
    await prisma.notification.create({
      data: {
        userId: session.userId,
        type: "session",
        title: "Mentor görüşmeyi başlattı 🎥",
        body: `${session.teacherName} "${session.skill}" oturumunu başlattı, hemen katılabilirsin.`,
        icon: "videocam-outline",
      },
    });
    void sendPushToUser(session.userId, {
      title: "Mentor görüşmeyi başlattı 🎥",
      body: `${session.teacherName} "${session.skill}" oturumunu başlattı, hemen katılabilirsin.`,
      data: { type: "session_call", sessionId: session.id },
    });
  }

  res.json(serializeSession(updated));
});

// POST /sessions/:id/call/end — mentor ya da öğrenci sonlandırabilir
sessionsRouter.post("/:id/call/end", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: "Kullanıcı bulunamadı" });

  const session = await prisma.session.findFirst({
    where: {
      id: req.params.id,
      OR: [{ userId: req.userId }, { teacherName: user.name }],
    },
  });
  if (!session) return res.status(404).json({ error: "Oturum bulunamadı" });

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      callStarted: false,
      callEndedAt: new Date(),
    },
  });
  res.json(serializeSession(updated));
});

// POST /sessions/:id/review — tamamlanan oturuma değerlendirme
sessionsRouter.post("/:id/review", async (req, res) => {
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!session) return res.status(404).json({ error: "Oturum bulunamadı" });

  const rating = Math.round(Number(req.body?.rating ?? 0));
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Puan 1-5 arasında olmalı" });
  }
  const comment = String(req.body?.comment ?? "");

  const teacher = await prisma.teacher.findFirst({
    where: { name: session.teacherName },
  });
  if (!teacher) {
    return res.status(404).json({ error: "Öğretmen bulunamadı" });
  }

  const existing = await prisma.review.findUnique({
    where: { sessionId: session.id },
  });
  if (existing) {
    return res.status(409).json({ error: "Bu oturum zaten değerlendirildi" });
  }

  await prisma.review.create({
    data: {
      teacherId: teacher.id,
      userId: req.userId!,
      sessionId: session.id,
      rating,
      comment,
    },
  });
  await prisma.session.update({
    where: { id: session.id },
    data: { rating, status: "completed" },
  });

  // Öğretmenin ortalama puanını güncelle
  const agg = await prisma.review.aggregate({
    where: { teacherId: teacher.id },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.teacher.update({
    where: { id: teacher.id },
    data: {
      rating: Number((agg._avg.rating ?? 0).toFixed(2)),
      reviews: agg._count,
    },
  });

  res.status(201).json({ ok: true });
});
