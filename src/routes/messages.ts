import { Router } from "express";
import { prisma } from "../prisma";
import { requireUser } from "../auth";
import { sendPushToUser } from "../push";

export const messagesRouter = Router();
messagesRouter.use(requireUser);

function hhmm(d: Date): string {
  return d.toTimeString().slice(0, 5);
}

// GET /conversations — sohbet listesi (engellenenler gizli)
messagesRouter.get("/", async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { ownerId: req.userId, blocked: false },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: {
        select: { messages: { where: { fromOwner: false, read: false } } },
      },
    },
  });

  res.json(
    conversations.map((c) => ({
      id: c.id,
      user: c.peerName,
      avatar: c.peerAvatar,
      avatarColor: c.peerColor,
      online: c.online,
      lastMessage: c.messages[0]?.text ?? "",
      time: c.messages[0] ? hhmm(c.messages[0].createdAt) : "",
      unread: c._count.messages,
    })),
  );
});

// POST /conversations — yeni sohbet başlat
messagesRouter.post("/", async (req, res) => {
  const peerName = String(req.body?.peerName ?? "").trim();
  if (!peerName) return res.status(400).json({ error: "Karşı taraf adı gerekli" });
  const peerUserId =
    typeof req.body?.peerUserId === "string" && req.body.peerUserId.length > 0
      ? req.body.peerUserId
      : null;

  // Aynı kişiyle sohbet varsa onu döndür (peerUserId varsa o önceliklidir)
  const existing = await prisma.conversation.findFirst({
    where: peerUserId
      ? { ownerId: req.userId, peerUserId }
      : { ownerId: req.userId, peerName },
  });
  if (existing) return res.json(existing);

  const conversation = await prisma.conversation.create({
    data: {
      ownerId: req.userId!,
      peerUserId,
      peerName,
      peerAvatar: String(req.body?.peerAvatar ?? peerName.slice(0, 2).toUpperCase()),
      peerColor: String(req.body?.peerColor ?? "#6366F1"),
      online: Boolean(req.body?.online ?? false),
    },
  });
  res.status(201).json(conversation);
});

// GET /conversations/:id/messages — sohbet mesajları (açılınca okundu işaretler)
messagesRouter.get("/:id/messages", async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
  });
  if (!conversation) {
    return res.status(404).json({ error: "Sohbet bulunamadı" });
  }

  await prisma.message.updateMany({
    where: { conversationId: conversation.id, fromOwner: false, read: false },
    data: { read: true },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });

  res.json({
    conversation: {
      id: conversation.id,
      user: conversation.peerName,
      avatar: conversation.peerAvatar,
      avatarColor: conversation.peerColor,
      online: conversation.online,
    },
    messages: messages.map((m) => ({
      id: m.id,
      text: m.text,
      imageUrl: m.imageUrl,
      fromMe: m.fromOwner,
      time: hhmm(m.createdAt),
      createdAt: m.createdAt,
    })),
  });
});

// POST /conversations/:id/block — sohbeti engelle (listeden gizler)
messagesRouter.post("/:id/block", async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
  });
  if (!conversation) {
    return res.status(404).json({ error: "Sohbet bulunamadı" });
  }
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { blocked: true },
  });
  res.json({ ok: true });
});

// POST /conversations/:id/unblock — sohbet engelini kaldır
messagesRouter.post("/:id/unblock", async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
  });
  if (!conversation) {
    return res.status(404).json({ error: "Sohbet bulunamadı" });
  }
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { blocked: false },
  });
  res.json({ ok: true });
});

// GET /conversations/blocked — engellenen sohbetler
messagesRouter.get("/blocked", async (req, res) => {
  const items = await prisma.conversation.findMany({
    where: { ownerId: req.userId, blocked: true },
    orderBy: { updatedAt: "desc" },
  });
  res.json(
    items.map((c) => ({
      id: c.id,
      user: c.peerName,
      avatar: c.peerAvatar,
      avatarColor: c.peerColor,
    })),
  );
});

// POST /conversations/:id/messages — mesaj gönder
messagesRouter.post("/:id/messages", async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
  });
  if (!conversation) {
    return res.status(404).json({ error: "Sohbet bulunamadı" });
  }
  if (conversation.blocked) {
    return res.status(403).json({ error: "Bu sohbeti engellediniz" });
  }

  const text = String(req.body?.text ?? "").trim();
  const rawImageUrl = req.body?.imageUrl;
  const imageUrl =
    typeof rawImageUrl === "string" && rawImageUrl.startsWith("https://")
      ? rawImageUrl
      : null;
  if (!text && !imageUrl) {
    return res.status(400).json({ error: "Mesaj boş olamaz" });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      fromOwner: true,
      text,
      imageUrl,
      read: true,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  // İki yönlü teslimat: peerUserId varsa karşı tarafın kendi conversation'ına
  // mesajı (fromOwner=false) ekle ve push at. peerUserId null ise (eski mock
  // conversation'lar) hiçbir şey yapma.
  if (conversation.peerUserId) {
    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, avatar: true, avatarColor: true },
    });
    if (me) {
      let peerConv = await prisma.conversation.findFirst({
        where: { ownerId: conversation.peerUserId, peerUserId: me.id },
      });
      if (!peerConv) {
        peerConv = await prisma.conversation.create({
          data: {
            ownerId: conversation.peerUserId,
            peerUserId: me.id,
            peerName: me.name,
            peerAvatar: me.avatar || me.name.slice(0, 2).toUpperCase(),
            peerColor: me.avatarColor || "#6366F1",
          },
        });
      }
      await prisma.message.create({
        data: {
          conversationId: peerConv.id,
          fromOwner: false,
          text,
          imageUrl,
          read: false,
        },
      });
      await prisma.conversation.update({
        where: { id: peerConv.id },
        data: { updatedAt: new Date() },
      });
      void sendPushToUser(conversation.peerUserId, {
        title: me.name,
        body: text || (imageUrl ? "📷 Fotoğraf" : ""),
        data: { type: "message", conversationId: peerConv.id },
      });
    }
  }

  res.status(201).json({
    id: message.id,
    text: message.text,
    imageUrl: message.imageUrl,
    fromMe: true,
    time: hhmm(message.createdAt),
    createdAt: message.createdAt,
  });
});
