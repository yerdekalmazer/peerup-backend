import { Router } from "express";
import { prisma } from "../prisma";
import { requireUser } from "../auth";

export const notificationsRouter = Router();
notificationsRouter.use(requireUser);

// GET /notifications — kullanıcının bildirimleri
notificationsRouter.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
  });
  const unread = notifications.filter((n) => !n.read).length;
  res.json({ notifications, unread });
});

// POST /notifications/read-all — tümünü okundu işaretle
notificationsRouter.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});

// POST /notifications/:id/read — tek bildirimi okundu işaretle
notificationsRouter.post("/:id/read", async (req, res) => {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!notification) {
    return res.status(404).json({ error: "Bildirim bulunamadı" });
  }
  await prisma.notification.update({
    where: { id: notification.id },
    data: { read: true },
  });
  res.json({ ok: true });
});
