import { Router } from "express";
import { prisma } from "../prisma";
import { requireUser } from "../auth";
import { publicUser, serializeTeacher, safeParse } from "../serialize";
import { sendPushToUser } from "../push";

export const profileRouter = Router();
profileRouter.use(requireUser);

// GET /profile — kullanıcı bilgisi + istatistikler
profileRouter.get("/", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  const [total, completed, upcoming, reviewsGiven] = await Promise.all([
    prisma.session.count({ where: { userId: req.userId } }),
    prisma.session.count({ where: { userId: req.userId, status: "completed" } }),
    prisma.session.count({ where: { userId: req.userId, status: "upcoming" } }),
    prisma.review.count({ where: { userId: req.userId } }),
  ]);

  res.json({
    user: publicUser(user),
    stats: {
      totalSessions: total,
      completedSessions: completed,
      upcomingSessions: upcoming,
      reviewsGiven,
    },
  });
});

// PUT /profile — profil güncelle (beceri listeleri dahil)
profileRouter.put("/", async (req, res) => {
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = String(b.name);
  if (b.bio !== undefined) data.bio = String(b.bio);
  if (b.university !== undefined) data.university = String(b.university);
  if (b.department !== undefined) data.department = String(b.department);
  if (b.avatarColor !== undefined) data.avatarColor = String(b.avatarColor);
  if (Array.isArray(b.skillsTeach)) {
    data.skillsTeach = JSON.stringify(b.skillsTeach.map(String));
  }
  if (Array.isArray(b.skillsLearn)) {
    data.skillsLearn = JSON.stringify(b.skillsLearn.map(String));
  }

  const user = await prisma.user.update({ where: { id: req.userId }, data });
  res.json(publicUser(user));
});

// DELETE /profile — hesabı kalıcı olarak siler.
// Notification, Conversation, Review, CoinTransaction cascade ile silinir;
// Session'larda userId SetNull yapılır (geçmiş istatistik için kayıt kalır).
profileRouter.delete("/", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  await prisma.user.delete({ where: { id: user.id } });
  res.json({ ok: true });
});

// POST /profile/apply-mentor — student rolündeki kullanıcı mentor olmak için başvurur.
// Aynı kullanıcı reddedildikten sonra tekrar başvurabilir; "approved" durumdaysa
// veya zaten "teacher" rolündeyse yeniden başvuru reddedilir.
profileRouter.post("/apply-mentor", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  if (user.role === "teacher") {
    return res.status(400).json({ error: "Zaten mentor rolündesin" });
  }
  if (user.mentorAppStatus === "pending") {
    return res.status(400).json({ error: "Başvurun zaten incelemede" });
  }
  if (user.mentorAppStatus === "approved") {
    return res.status(400).json({ error: "Başvurun onaylandı" });
  }

  const message = String(req.body?.message ?? "").trim();
  if (message.length < 20) {
    return res
      .status(400)
      .json({ error: "Lütfen en az 20 karakterlik bir açıklama yaz" });
  }
  if (message.length > 600) {
    return res.status(400).json({ error: "Açıklama çok uzun" });
  }

  await prisma.user.update({
    where: { id: req.userId },
    data: {
      mentorAppStatus: "pending",
      mentorAppMessage: message,
      mentorAppAt: new Date(),
    },
  });
  await prisma.notification.create({
    data: {
      userId: req.userId!,
      type: "info",
      title: "Mentor başvurun alındı 🎓",
      body: "İnceleme tamamlandığında haber vereceğiz.",
      icon: "school-outline",
    },
  });
  res.status(201).json({ ok: true });
});

// PUT /profile/push-token — Expo push token kaydet ({ token, platform })
// Token boş string ise kaydı sıfırlar (logout / izin reddi durumu).
profileRouter.put("/push-token", async (req, res) => {
  const raw = req.body?.token;
  const token = typeof raw === "string" && raw.startsWith("ExponentPushToken") ? raw : null;
  const platform = typeof req.body?.platform === "string" ? req.body.platform : null;

  await prisma.user.update({
    where: { id: req.userId },
    data: { pushToken: token, pushPlatform: platform },
  });
  res.json({ ok: true });
});

// POST /profile/topup — SkillCoin yükle
profileRouter.post("/topup", async (req, res) => {
  const amount = Number(req.body?.amount ?? 0);
  if (!amount || amount <= 0 || amount > 1000) {
    return res.status(400).json({ error: "Geçerli bir miktar girin" });
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { coins: { increment: amount } },
  });
  await prisma.coinTransaction.create({
    data: {
      userId: req.userId!,
      amount,
      type: "topup",
      description: "SkillCoin yükleme",
    },
  });
  await prisma.notification.create({
    data: {
      userId: req.userId!,
      type: "coin",
      title: "SkillCoin yüklendi 💰",
      body: `Hesabına ${amount} SkillCoin eklendi.`,
      icon: "logo-bitcoin",
    },
  });
  void sendPushToUser(req.userId!, {
    title: "SkillCoin yüklendi 💰",
    body: `Hesabına ${amount} SkillCoin eklendi.`,
    data: { type: "coin" },
  });
  res.json(publicUser(user));
});

// GET /profile/transactions — SkillCoin işlem geçmişi
profileRouter.get("/transactions", async (req, res) => {
  const transactions = await prisma.coinTransaction.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
  });
  res.json(transactions);
});

// GET /profile/reviews — kullanıcının yazdığı değerlendirmeler
profileRouter.get("/reviews", async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: {
        select: { name: true, avatar: true, avatarColor: true, skill: true },
      },
    },
  });
  res.json(reviews);
});

// ── Kaydedilen öğretmenler ───────────────────────────────────

// GET /profile/saved — kaydedilen öğretmenler
profileRouter.get("/saved", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });
  const ids: string[] = safeParse(user.savedTeachers);
  const teachers = await prisma.teacher.findMany({
    where: { id: { in: ids } },
  });
  res.json(teachers.map(serializeTeacher));
});

// POST /profile/saved — öğretmen kaydet ({ teacherId })
profileRouter.post("/saved", async (req, res) => {
  const teacherId = String(req.body?.teacherId ?? "");
  if (!teacherId) return res.status(400).json({ error: "teacherId gerekli" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  const ids: string[] = safeParse(user.savedTeachers);
  if (!ids.includes(teacherId)) ids.push(teacherId);

  await prisma.user.update({
    where: { id: req.userId },
    data: { savedTeachers: JSON.stringify(ids) },
  });
  res.json({ savedTeachers: ids });
});

// DELETE /profile/saved/:teacherId — kaydı kaldır
profileRouter.delete("/saved/:teacherId", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

  const ids: string[] = safeParse(user.savedTeachers).filter(
    (id: string) => id !== req.params.teacherId,
  );
  await prisma.user.update({
    where: { id: req.userId },
    data: { savedTeachers: JSON.stringify(ids) },
  });
  res.json({ savedTeachers: ids });
});
