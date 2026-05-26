import { Router } from "express";
import { prisma } from "../prisma";
import { requireUser } from "../auth";

// Mobil uygulama → kullanıcının kendisi şikayet açar.
export const reportsRouter = Router();
reportsRouter.use(requireUser);

reportsRouter.post("/", async (req, res) => {
  const b = req.body ?? {};
  const targetType = String(b.targetType ?? "");
  const targetId = String(b.targetId ?? "");
  const reason = String(b.reason ?? "").trim();
  const note = String(b.note ?? "").trim();

  if (!["user", "teacher", "session"].includes(targetType)) {
    return res
      .status(400)
      .json({ error: "Hedef tipi user/teacher/session olmalı" });
  }
  if (!targetId) {
    return res.status(400).json({ error: "Hedef kimliği zorunlu" });
  }
  if (!reason) {
    return res.status(400).json({ error: "Gerekçe zorunlu" });
  }
  if (reason.length > 200) {
    return res.status(400).json({ error: "Gerekçe çok uzun" });
  }

  const reporter = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true },
  });

  const report = await prisma.report.create({
    data: {
      targetType,
      targetId,
      reason,
      note: note.slice(0, 600),
      reporterId: reporter?.id ?? "",
      reporterName: reporter?.name ?? "",
    },
    select: { id: true, status: true, createdAt: true },
  });

  res.status(201).json({ ok: true, report });
});
