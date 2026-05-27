/**
 * Grup oturumu (GroupSlot) akışı.
 *
 * - Mentor (role=teacher) `POST /api/group-slots` ile yeni slot açar.
 * - Tüm kullanıcılar `GET /api/group-slots` ile yaklaşan slot'ları görür.
 * - Öğrenci `POST /api/group-slots/:id/join` ile katılır; her join için
 *   ayrı bir Session kaydı yaratılır ve `groupSlotId` ile slot'a bağlanır.
 *   Coin düşülür, çakışma/kapasite kontrolü yapılır.
 */
import { Router } from "express";
import { prisma } from "../prisma";
import { requireUser } from "../auth";
import { serializeSession } from "../serialize";
import { sendPushToUser } from "../push";

export const groupRouter = Router();
groupRouter.use(requireUser);

// POST /api/group-slots — mentor yeni grup slotu açar
groupRouter.post("/", async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!me) return res.status(401).json({ error: "Kullanıcı bulunamadı" });
  if (me.role !== "teacher") {
    return res
      .status(403)
      .json({ error: "Sadece mentor rolündeki kullanıcılar grup dersi açabilir" });
  }

  const b = req.body ?? {};
  const skill = String(b.skill ?? "").trim();
  const date = String(b.date ?? "").trim();
  const time = String(b.time ?? "").trim();
  const maxParticipants = Math.max(2, Math.min(50, Number(b.maxParticipants ?? 4)));
  const costPerSeat = Math.max(0, Number(b.costPerSeat ?? 1));
  const duration = Math.max(15, Math.min(240, Number(b.duration ?? 60)));
  const description = String(b.description ?? "").slice(0, 600);

  if (!skill || !date || !time) {
    return res.status(400).json({ error: "Beceri, tarih ve saat zorunludur" });
  }

  const slot = await prisma.groupSlot.create({
    data: {
      mentorUserId: me.id,
      teacherName: me.name,
      teacherAvatar: me.avatar || me.name.slice(0, 2).toUpperCase(),
      avatarColor: me.avatarColor,
      skill,
      description,
      date,
      time,
      duration,
      costPerSeat,
      maxParticipants,
    },
  });
  res.status(201).json(slot);
});

// GET /api/group-slots?skill= — yaklaşan grup slot'ları + katılımcı sayısı
groupRouter.get("/", async (req, res) => {
  const skill = (req.query.skill as string | undefined)?.trim();
  const slots = await prisma.groupSlot.findMany({
    where: {
      status: "upcoming",
      ...(skill ? { skill: { contains: skill } } : {}),
    },
    include: {
      _count: { select: { sessions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(
    slots.map((s) => ({
      id: s.id,
      mentorUserId: s.mentorUserId,
      teacherName: s.teacherName,
      teacherAvatar: s.teacherAvatar,
      avatarColor: s.avatarColor,
      skill: s.skill,
      description: s.description,
      date: s.date,
      time: s.time,
      duration: s.duration,
      costPerSeat: s.costPerSeat,
      maxParticipants: s.maxParticipants,
      participantCount: s._count.sessions,
      remainingSeats: Math.max(0, s.maxParticipants - s._count.sessions),
      isFull: s._count.sessions >= s.maxParticipants,
    })),
  );
});

// POST /api/group-slots/:id/join — öğrenci katılır, Session kaydı oluşur
groupRouter.post("/:id/join", async (req, res) => {
  const slot = await prisma.groupSlot.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { sessions: true } } },
  });
  if (!slot) return res.status(404).json({ error: "Slot bulunamadı" });
  if (slot.status !== "upcoming") {
    return res.status(400).json({ error: "Bu slot artık aktif değil" });
  }
  if (slot.mentorUserId === req.userId) {
    return res.status(400).json({ error: "Kendi açtığın slot'a katılamazsın" });
  }
  if (slot._count.sessions >= slot.maxParticipants) {
    return res.status(409).json({ error: "Slot dolu" });
  }

  const me = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!me) return res.status(401).json({ error: "Kullanıcı bulunamadı" });
  if (me.coins < slot.costPerSeat) {
    return res.status(400).json({ error: "Yetersiz SkillCoin bakiyesi" });
  }

  // Aynı kullanıcı aynı slot'a iki kez katılamasın
  const existing = await prisma.session.findFirst({
    where: { userId: me.id, groupSlotId: slot.id, status: "upcoming" },
  });
  if (existing) {
    return res.status(409).json({ error: "Zaten bu slot'a katıldın" });
  }

  const session = await prisma.session.create({
    data: {
      userId: me.id,
      teacherName: slot.teacherName,
      teacherAvatar: slot.teacherAvatar,
      avatarColor: slot.avatarColor,
      skill: slot.skill,
      date: slot.date,
      time: slot.time,
      duration: slot.duration,
      cost: slot.costPerSeat,
      type: "online",
      status: "upcoming",
      maxParticipants: slot.maxParticipants,
      groupSlotId: slot.id,
    },
  });
  await prisma.user.update({
    where: { id: me.id },
    data: { coins: { decrement: slot.costPerSeat } },
  });
  await prisma.coinTransaction.create({
    data: {
      userId: me.id,
      amount: -slot.costPerSeat,
      type: "spend",
      description: `${slot.skill} grup dersine katılım`,
    },
  });
  await prisma.notification.create({
    data: {
      userId: me.id,
      type: "session",
      title: "Grup dersine katıldın 🎓",
      body: `${slot.teacherName} ile ${slot.date} ${slot.time} grup dersine yer ayrıldı.`,
      icon: "people-outline",
    },
  });
  void sendPushToUser(slot.mentorUserId, {
    title: "Yeni katılımcı 🙋",
    body: `${me.name} "${slot.skill}" grup dersine katıldı.`,
    data: { type: "session", sessionId: session.id },
  });

  res.status(201).json(serializeSession(session));
});

// DELETE /api/group-slots/:id — mentor kendi slot'unu iptal eder
groupRouter.delete("/:id", async (req, res) => {
  const slot = await prisma.groupSlot.findUnique({ where: { id: req.params.id } });
  if (!slot) return res.status(404).json({ error: "Slot bulunamadı" });
  if (slot.mentorUserId !== req.userId) {
    return res.status(403).json({ error: "Sadece kendi slot'unu iptal edebilirsin" });
  }
  await prisma.groupSlot.update({
    where: { id: slot.id },
    data: { status: "cancelled" },
  });
  // Bağlı session'lar otomatik cancel + iade
  const sessions = await prisma.session.findMany({
    where: { groupSlotId: slot.id, status: "upcoming" },
  });
  for (const s of sessions) {
    if (s.userId) {
      await prisma.user.update({
        where: { id: s.userId },
        data: { coins: { increment: s.cost } },
      });
      await prisma.coinTransaction.create({
        data: {
          userId: s.userId,
          amount: s.cost,
          type: "refund",
          description: `${s.skill} grup dersi iptal iadesi`,
        },
      });
      await prisma.notification.create({
        data: {
          userId: s.userId,
          type: "session",
          title: "Grup dersi iptal edildi",
          body: `${s.teacherName} "${s.skill}" dersini iptal etti; ücret iade edildi.`,
          icon: "close-circle-outline",
        },
      });
    }
  }
  await prisma.session.updateMany({
    where: { groupSlotId: slot.id, status: "upcoming" },
    data: { status: "cancelled" },
  });
  res.json({ ok: true });
});
