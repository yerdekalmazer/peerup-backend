import { Router } from "express";
import { prisma } from "../prisma";
import { requireUser } from "../auth";

export const messagesRouter = Router();
messagesRouter.use(requireUser);

function hhmm(d: Date): string {
  return d.toTimeString().slice(0, 5);
}

// GET /conversations — sohbet listesi
messagesRouter.get("/", async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { ownerId: req.userId },
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

  // Aynı kişiyle sohbet varsa onu döndür
  const existing = await prisma.conversation.findFirst({
    where: { ownerId: req.userId, peerName },
  });
  if (existing) return res.json(existing);

  const conversation = await prisma.conversation.create({
    data: {
      ownerId: req.userId!,
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
      fromMe: m.fromOwner,
      time: hhmm(m.createdAt),
      createdAt: m.createdAt,
    })),
  });
});

// POST /conversations/:id/messages — mesaj gönder
messagesRouter.post("/:id/messages", async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, ownerId: req.userId },
  });
  if (!conversation) {
    return res.status(404).json({ error: "Sohbet bulunamadı" });
  }

  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "Mesaj boş olamaz" });

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, fromOwner: true, text, read: true },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  res.status(201).json({
    id: message.id,
    text: message.text,
    fromMe: true,
    time: hhmm(message.createdAt),
    createdAt: message.createdAt,
  });
});
